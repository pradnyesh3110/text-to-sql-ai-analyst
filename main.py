# backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

import os
import shutil
import traceback

load_dotenv()

# ── Imports ──────────────────────────────────────
from backend.database         import engine
from backend.file_uploader    import load_file_to_db
from backend.prompt_builder   import build_prompt
from backend.llm_client       import get_sql_from_llm
from backend.sql_executor     import execute_with_retry
from backend.schema_extractor import get_schema_text
from backend.rag.retriever    import get_similar_examples

print("=" * 50)
print("Loaded:", __file__)
print("=" * 50)

# ── App ──────────────────────────────────────────
app = FastAPI(title="Text-to-SQL AI Analyst")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request Models ───────────────────────────────
class QueryRequest(BaseModel):
    question: str

class BatchRequest(BaseModel):
    questions: list

class CleanRequest(BaseModel):
    actions: list

class PBITemplateRequest(BaseModel):
    dax_measures: list
    chart_type  : str = "bar"
    table_name  : str = "user_data"

class PredictRequest(BaseModel):
    periods   : int = 30
    date_col  : str = ""
    value_col : str = ""

class AutoMLRequest(BaseModel):
    target_accuracy: float = 0.85
    target_col     : str   = ""
    clean_first    : bool  = True


# ==========================================================
# HOME
# ==========================================================
@app.get("/")
def home():
    return {"status": "running"}


# ==========================================================
# SCHEMA — simple text for LLM
# ==========================================================
@app.get("/schema")
def schema():
    return {"schema": get_schema_text()}


# ==========================================================
# UPLOAD — single file
# ==========================================================
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    print(f">>> Upload: {file.filename}")

    ALLOWED = [
        ".csv",".xlsx",".xls",
        ".json",".pdf",".tsv",".txt"
    ]
    ext = os.path.splitext(file.filename)[1].lower()

    if ext not in ALLOWED:
        return {
            "success": False,
            "error"  : f"File type '{ext}' not supported. "
                       f"Allowed: {', '.join(ALLOWED)}"
        }

    safe_name = file.filename.replace(" ", "_")
    temp_path = f"temp_{safe_name}"

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        result = load_file_to_db(temp_path)

        return {
            "success"    : True,
            "message"    : f"{result['rows_loaded']} rows loaded successfully",
            "table"      : result["table_name"],
            "rows"       : result["rows_loaded"],
            "columns"    : result["columns"],
            "sample"     : result["sample"],
            "file_type"  : result["file_type"],
            "issues"     : result["issues"],
            "issue_count": result["issue_count"],
            "summary"    : result["summary"]
        }

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ==========================================================
# UPLOAD — multiple files
# ==========================================================
@app.post("/upload-multiple")
async def upload_multiple_files(
    files: list[UploadFile] = File(...),
    merge: bool = True
):
    from backend.file_uploader import load_multiple_files
    print(f">>> Multi upload: {len(files)} files, merge={merge}")

    ALLOWED    = [".csv",".xlsx",".xls",".json",".tsv",".txt"]
    temp_paths = []

    try:
        for file in files:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED:
                continue
            safe_name = file.filename.replace(" ", "_")
            temp_path = f"temp_multi_{safe_name}"
            with open(temp_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            temp_paths.append(temp_path)

        if not temp_paths:
            return {"success": False, "error": "No valid files"}

        result = load_multiple_files(temp_paths, merge=merge)
        return result

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}

    finally:
        for p in temp_paths:
            if os.path.exists(p):
                os.remove(p)


# ==========================================================
# QUERY
# ==========================================================
@app.post("/query")
def query(req: QueryRequest):
    try:
        q            = req.question
        rag_examples = get_similar_examples(q, n=3)
        prompt       = build_prompt(q, rag_examples)
        sql          = get_sql_from_llm(prompt)
        result       = execute_with_retry(sql, q)
        return {
            "question": q,
            "sql"     : sql,
            "result"  : result
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "question": req.question,
            "sql"     : "",
            "result"  : {"columns": [], "rows": []},
            "error"   : str(e)
        }


# ==========================================================
# BATCH
# ==========================================================
@app.post("/batch")
def batch_query(req: BatchRequest):
    from backend.batch_handler import run_batch
    if not req.questions:
        return {"error": "No questions provided"}
    if len(req.questions) > 15:
        return {"error": "Max 15 questions per batch"}
    results = run_batch(req.questions)
    success = sum(
        1 for r in results if r["status"] == "success"
    )
    return {
        "total"  : len(results),
        "success": success,
        "failed" : len(results) - success,
        "results": results
    }


# ==========================================================
# DAX
# ==========================================================
@app.post("/dax")
def dax_query(req: QueryRequest):
    from backend.dax_builder import generate_dax
    dax = generate_dax(req.question)
    return {
        "question"    : req.question,
        "dax"         : dax,
        "instructions": [
            "1. Open Power BI Desktop on your PC",
            "2. Load your CSV: Home → Get Data → Text/CSV",
            "3. Go to Modeling tab → click New Measure",
            "4. Delete the default text completely",
            "5. Paste the DAX code above → press Enter",
            "6. Drag your new measure onto any chart"
        ]
    }


# ==========================================================
# CLEAN DATA
# ==========================================================
@app.post("/clean")
def clean_data(req: CleanRequest):
    try:
        import pandas as pd
        from sqlalchemy import text
        from backend.data_quality import auto_clean, detect_issues

        df       = pd.read_sql('SELECT * FROM "user_data"', engine)
        df_clean = auto_clean(df, req.actions)

        with engine.connect() as conn:
            conn.execute(
                text('DROP TABLE IF EXISTS "user_data"')
            )
            conn.commit()

        df_clean.to_sql(
            name      = "user_data",
            con       = engine,
            if_exists = "replace",
            index     = False,
            method    = "multi"
        )

        remaining = detect_issues(df_clean)

        return {
            "success"         : True,
            "rows_before"     : len(df),
            "rows_after"      : len(df_clean),
            "rows_removed"    : len(df) - len(df_clean),
            "remaining_issues": remaining
        }

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# ==========================================================
# EDA REPORT
# ==========================================================
@app.get("/eda")
def eda_report():
    try:
        import pandas as pd
        from backend.eda_generator import (
            generate_eda,
            get_eda_summary_for_llm
        )

        df      = pd.read_sql(
            'SELECT * FROM "user_data"', engine
        )
        eda     = generate_eda(df, filename="user_data")
        summary = get_eda_summary_for_llm(eda)

        prompt = f"""You are a senior data analyst.
Write a professional paragraph (5-7 sentences)
summarizing this dataset. Be specific with numbers.
Mention key findings and recommendations.

{summary}

Analysis:"""

        try:
            eda["narrative"] = get_sql_from_llm(prompt)
        except Exception:
            eda["narrative"] = (
                f"Dataset has {eda['overview']['total_rows']} rows, "
                f"{eda['overview']['total_columns']} columns, "
                f"{eda['overview']['missing_pct']}% missing values."
            )

        return eda

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ==========================================================
# SCHEMA DETAILS
# ==========================================================
@app.get("/schema-details")
def schema_details():
    try:
        from sqlalchemy import inspect, text

        inspector = inspect(engine)
        tables    = {}

        for table in inspector.get_table_names():
            cols     = inspector.get_columns(table)
            pk_cols  = inspector.get_pk_constraint(table)
            fk_cols  = inspector.get_foreign_keys(table)

            pk_names = pk_cols.get("constrained_columns", [])
            fk_names = {
                fk["constrained_columns"][0]: fk["referred_table"]
                for fk in fk_cols
                if fk["constrained_columns"]
            }

            columns = []
            for c in cols:
                col_name = c["name"]
                col_type = str(c["type"])
                is_pk    = col_name in pk_names
                fk_ref   = fk_names.get(col_name)
                n        = col_name.lower()
                t        = col_type.lower()

                if is_pk:
                    role = "🔑 Primary Key"
                elif fk_ref:
                    role = f"🔗 FK → {fk_ref}"
                elif any(w in n for w in [
                    "date","time","month","year","day"
                ]):
                    role = "📅 Date"
                elif any(w in n for w in [
                    "id","code","key","no","num"
                ]):
                    role = "🆔 Identifier"
                elif t in [
                    "integer","bigint","numeric",
                    "float","double"
                ]:
                    if any(w in n for w in [
                        "sale","revenue","amount","price",
                        "cost","profit","total","qty","quantity"
                    ]):
                        role = "💰 Measure"
                    else:
                        role = "🔢 Numeric"
                else:
                    if any(w in n for w in [
                        "product","item","name",
                        "category","type","class"
                    ]):
                        role = "🏷️ Category"
                    elif any(w in n for w in [
                        "region","city","country",
                        "location","area","zone",
                        "dept","department"
                    ]):
                        role = "🌍 Dimension"
                    else:
                        role = "📝 Text"

                columns.append({
                    "name"  : col_name,
                    "type"  : col_type,
                    "is_pk" : is_pk,
                    "fk_ref": fk_ref,
                    "role"  : role
                })

            measures    = [
                c for c in columns
                if "Measure" in c["role"]
            ]
            dimensions  = [
                c for c in columns
                if c["role"] in [
                    "🏷️ Category","🌍 Dimension","📅 Date"
                ]
            ]
            identifiers = [
                c for c in columns
                if "Identifier" in c["role"]
            ]

            if len(measures) >= 2 and len(dimensions) >= 2:
                schema_type = "⭐ Star Schema"
                schema_note = (
                    f"Fact: {table} | "
                    f"Dimensions: "
                    f"{', '.join([d['name'] for d in dimensions[:4]])}"
                )
            elif len(measures) == 1:
                schema_type = "📊 Simple Fact Table"
                schema_note = f"One measure: {measures[0]['name']}"
            elif len(identifiers) >= 1:
                schema_type = "📋 Dimension Table"
                schema_note = "Lookup/reference table"
            else:
                schema_type = "📄 Flat Table"
                schema_note = "General purpose table"

            tables[table] = {
                "columns"    : columns,
                "schema_type": schema_type,
                "schema_note": schema_note,
                "row_count"  : 0
            }

        with engine.connect() as conn:
            for table in tables:
                try:
                    count = conn.execute(
                        text(f'SELECT COUNT(*) FROM "{table}"')
                    ).scalar()
                    tables[table]["row_count"] = count
                except Exception:
                    pass

        return {"tables": tables}

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


# ==========================================================
# PREDICT — time series forecasting
# ==========================================================
@app.post("/predict")
def predict(req: PredictRequest):
    try:
        import pandas as pd
        from backend.predictor import (
            detect_time_series,
            run_forecast
        )

        df = pd.read_sql('SELECT * FROM "user_data"', engine)

        if req.date_col and req.value_col:
            date_col  = req.date_col
            value_col = req.value_col
        else:
            detected = detect_time_series(df)
            if not detected["detected"]:
                return {
                    "success": False,
                    "error"  : (
                        "No date column found. "
                        "Upload data with a date column "
                        "for forecasting."
                    )
                }
            date_col  = detected["date_col"]
            value_col = detected["value_col"]

        result = run_forecast(
            df, date_col, value_col, req.periods
        )

        if not result.get("success"):
            return result

        # LLM narrative
        stats  = result["stats"]
        prompt = f"""You are a data analyst.
Write 3-4 sentences explaining this forecast.
Be specific with numbers.
Mention trend direction and business implications.

Data: {value_col} over time
Current value: {stats['latest']}
Forecasted value in {stats['forecast_days']} days: {stats['forecast_next']}
Trend: {stats['trend_dir']} ({stats['trend_pct']}% change)
Data points: {stats['data_points']}

Forecast explanation:"""

        try:
            result["narrative"] = get_sql_from_llm(prompt)
        except Exception:
            result["narrative"] = (
                f"{value_col} shows a {stats['trend_dir']} trend. "
                f"Current: {stats['latest']}. "
                f"Forecast ({stats['forecast_days']} days): "
                f"{stats['forecast_next']} "
                f"({stats['trend_pct']:+}% change)."
            )

        return result

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# ==========================================================
# AUTOML
# ==========================================================
@app.post("/automl")
def automl(req: AutoMLRequest):
    try:
        import pandas as pd
        from backend.automl import (
            analyze_dataset,
            ask_ollama_for_recommendation,
            run_automl
        )
        from backend.data_quality import auto_clean, detect_issues

        df = pd.read_sql('SELECT * FROM "user_data"', engine)

        # Step 1: clean data first
        cleaned = 0
        if req.clean_first:
            issues  = detect_issues(df)
            df      = auto_clean(df, issues)
            cleaned = len(issues)

        # Step 2: analyze dataset
        info = analyze_dataset(df)

        if req.target_col and req.target_col in df.columns:
            if req.target_col not in info["potential_targets"]:
                info["potential_targets"].insert(
                    0, req.target_col
                )

        # Step 3: Ollama recommends ML approach
        print("Asking Ollama for ML recommendation...")
        recommendation = ask_ollama_for_recommendation(info)
        print(f"Recommendation: {recommendation}")

        # Step 4: train models with 70/30 split
        print(f"Running AutoML — target: "
              f"{req.target_accuracy*100}%")
        ml_result = run_automl(
            df,
            recommendation,
            target_accuracy=req.target_accuracy
        )

        if "error" in ml_result:
            return {
                "success"       : False,
                "error"         : ml_result["error"],
                "recommendation": recommendation,
                "dataset_info"  : info
            }

        # Step 5: LLM narrative
        best  = ml_result.get("best_model", "Unknown")
        acc   = ml_result.get("best_accuracy_pct", "N/A")
        task  = ml_result.get("task", "regression")
        feats = ml_result.get("feature_importance", [])[:3]

        top_features = ", ".join([
            f"{f['feature']} ({f['pct']}%)"
            for f in feats
        ]) if feats else "N/A"

        prompt = f"""You are a data scientist.
Write 3-4 sentences explaining these ML results.
Be specific and business-focused.

Task: {task}
Best model: {best}
Accuracy: {acc}
Train/Test: 70% training / 30% testing
Top features: {top_features}
Target: {ml_result.get('target_column')}
Reached target accuracy: {ml_result.get('reached_target')}

Explanation:"""

        try:
            narrative = get_sql_from_llm(prompt)
        except Exception:
            narrative = (
                f"Best model: {best} with {acc} accuracy "
                f"on {task} task. "
                f"Top predictor: {top_features}."
            )

        return {
            "success"       : True,
            "cleaned_issues": cleaned,
            "dataset_info"  : info,
            "recommendation": recommendation,
            "ml_result"     : ml_result,
            "narrative"     : narrative
        }

    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# ==========================================================
# DOWNLOAD POWER BI TEMPLATE
# ==========================================================
@app.post("/download-pbi-template")
def download_pbi_template(req: PBITemplateRequest):
    try:
        from backend.pbi_template import generate_professional_pbit
        from backend.dax_builder  import (
            get_user_data_columns,
            generate_all_dax_measures
        )

        cols         = get_user_data_columns()
        dax_measures = generate_all_dax_measures(
            table=req.table_name, cols=cols
        )

        pbit_bytes = generate_professional_pbit(
            table_name   = req.table_name,
            columns      = cols["all_cols"],
            dax_measures = dax_measures
        )

        return Response(
            content    = pbit_bytes,
            media_type = "application/octet-stream",
            headers    = {
                "Content-Disposition":
                    "attachment; filename=AI_Dashboard.pbit"
            }
        )

    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}