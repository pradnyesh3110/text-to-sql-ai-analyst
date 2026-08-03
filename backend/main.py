# backend/main.py
from fastapi import FastAPI, UploadFile, File, Header, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import text as sqltext
from typing import Optional
import os
import re
import shutil
import traceback

load_dotenv()

from backend.database         import engine, get_db, User, UserFile
from backend.file_uploader    import load_file_to_db
from backend.prompt_builder   import build_prompt
from backend.llm_client       import get_sql_from_llm
from backend.sql_executor     import execute_with_retry, is_within_allowed_tables
from backend.schema_extractor import get_schema_text
from backend.rag.retriever    import get_similar_examples
from backend.auth import (
    hash_password, verify_password, create_token, get_current_user,
    FREE_QUERY_LIMIT, verify_google_token
)
from backend.auth import SECRET_KEY, ALGORITHM
from backend.subscriptions import sync_subscription_status, grant_subscription, subscription_summary
from jose import jwt, JWTError
from fastapi.staticfiles import StaticFiles

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
MAX_FILES_FREE = 5  # free plan file-count cap; pro plan is unlimited (still bounded by storage_quota_mb)

print("=" * 50)
print("Loaded:", __file__)
print("=" * 50)

app = FastAPI(title="Text-to-SQL AI Analyst")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str

class BatchRequest(BaseModel):
    questions: list

class CleanRequest(BaseModel):
    actions: list
    table  : str = "user_data"

class PBITemplateRequest(BaseModel):
    dax_measures: list
    chart_type  : str = "bar"
    table_name  : str = "user_data"

class PredictRequest(BaseModel):
    periods   : int = 30
    date_col  : str = ""
    value_col : str = ""
    table     : str = "user_data"

class AutoMLRequest(BaseModel):
    target_accuracy: float = 0.85
    target_col     : str   = ""
    clean_first    : bool  = True
    table          : str   = "user_data"

class ChartRequest(BaseModel):
    instruction  : str
    table        : str = "user_data"
    previous_spec: dict = None
    chart_type   : str = None

class RegisterRequest(BaseModel):
    email   : str
    password: str

class LoginRequest(BaseModel):
    email   : str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

class SubscribeRequest(BaseModel):
    plan: str = "pro"
    days: int = 30


def get_optional_user(authorization: Optional[str], db: Session):
    """Best-effort JWT decode. Returns User or None. Never raises."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        user = db.query(User).filter(User.email == email).first()
        if user and email.lower() in ADMIN_EMAILS and not user.is_admin:
            user.is_admin = True
            db.commit()
        return user
    except JWTError:
        return None


def sanitize_table_name(user_id: int, filename: str) -> str:
    base = os.path.splitext(filename)[0].lower()
    base = re.sub(r"[^a-z0-9_]", "_", base)
    base = re.sub(r"_+", "_", base).strip("_")[:40]
    return f"u{user_id}_{base or 'file'}"


def get_user_files(user: User, db: Session):
    return db.query(UserFile).filter(UserFile.user_id == user.id).order_by(UserFile.uploaded_at.desc()).all()


def recompute_storage(user: User, db: Session):
    files = get_user_files(user, db)
    user.storage_used_mb = round(sum(f.size_mb for f in files), 3)
    db.commit()
    db.refresh(user)


def resolve_table_name(table: str, authorization: Optional[str], db: Session) -> str:
    """Validates that `table` is either the shared demo table, or a table
    the requesting user actually owns. Raises 403/404 otherwise."""
    user = get_optional_user(authorization, db)
    if not table or table == "user_data":
        if user is not None:
            # logged-in users don't share the anonymous demo table
            raise HTTPException(status_code=400, detail="Specify which of your uploaded files to use (table name).")
        return "user_data"
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to access your uploaded files.")
    owned = db.query(UserFile).filter(UserFile.user_id == user.id, UserFile.table_name == table).first()
    if not owned:
        raise HTTPException(status_code=404, detail="File not found in your account.")
    return table


def detect_target_table(question: str, files: list):
    """Find which uploaded file (if any) the question is referring to by
    name, e.g. 'highest sale this month in sales_march.csv'. Picks the
    longest matching filename/table name to avoid partial overlaps."""
    q = question.lower()
    best = None
    for f in files:
        candidates = {
            f.table_name.lower(),
            os.path.splitext(f.original_filename)[0].lower().replace(" ", "_"),
            os.path.splitext(f.original_filename)[0].lower(),
        }
        for c in candidates:
            if c and c in q:
                if best is None or len(c) > len(best[1]):
                    best = (f.table_name, c)
    return best[0] if best else None


from fastapi.responses import FileResponse

@app.get("/")
def home():
    return FileResponse("static/index.html")

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, hashed_password=hash_password(req.password), query_count=0)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token({"sub": user.email})
    return {"success": True, "token": token, "email": user.email,
            "query_count": user.query_count, "limit": FREE_QUERY_LIMIT}


@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"sub": user.email})
    return {"success": True, "token": token, "email": user.email,
            "query_count": user.query_count, "limit": FREE_QUERY_LIMIT}


@app.post("/auth/google")
def auth_google(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    payload = verify_google_token(req.credential)
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, hashed_password=None, query_count=0)
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_token({"sub": user.email})
    return {"success": True, "token": token, "email": user.email,
            "query_count": user.query_count, "limit": FREE_QUERY_LIMIT}


@app.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = sync_subscription_status(user, db)
    return {"email": user.email, "query_count": user.query_count, "limit": FREE_QUERY_LIMIT,
            "is_admin": user.is_admin, "subscription": subscription_summary(user)}


@app.post("/subscribe")
def subscribe(req: SubscribeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Activates/renews a paid plan for the current user.
    NOTE: this grants the plan directly with no payment check — wire this
    up behind your real payment provider's webhook before going live."""
    user = grant_subscription(user, db, plan=req.plan, days=req.days)
    return {"success": True, "subscription": subscription_summary(user)}


@app.get("/admin/users")
def admin_list_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access only")
    users = db.query(User).order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        sync_subscription_status(u, db)
        out.append({
            "email": u.email, "plan": u.plan, "status": u.subscription_status,
            "expires_at": u.subscription_expires_at.isoformat() if u.subscription_expires_at else None,
            "query_count": u.query_count, "storage_used_mb": round(u.storage_used_mb, 2),
            "storage_quota_mb": u.storage_quota_mb, "created_at": u.created_at.isoformat()
        })
    return {"users": out, "total": len(out),
            "active_subscribers": sum(1 for u in users if u.plan != "free" and u.subscription_status == "active"),
            "expired_subscribers": sum(1 for u in users if u.subscription_status == "expired")}


@app.get("/schema")
def schema(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    user = get_optional_user(authorization, db)
    if user is not None:
        table_names = [f.table_name for f in get_user_files(user, db)]
        return {"schema": get_schema_text(table_names) if table_names else "No files uploaded yet."}
    # anonymous/demo — only ever show the shared demo table, never other users' private tables
    return {"schema": get_schema_text(["user_data"])}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), authorization: Optional[str] = Header(default=None),
                       db: Session = Depends(get_db)):
    print(f">>> Upload: {file.filename}")
    ALLOWED = [".csv",".xlsx",".xls",".json",".pdf",".tsv",".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED:
        return {"success": False, "error": f"File type '{ext}' not supported."}

    user = get_optional_user(authorization, db)
    safe_name = file.filename.replace(" ", "_")
    temp_path = f"temp_{safe_name}"
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        size_mb = round(os.path.getsize(temp_path) / (1024 * 1024), 3)

        if user is not None:
            user = sync_subscription_status(user, db)
            existing = db.query(UserFile).filter(
                UserFile.user_id == user.id,
                UserFile.table_name == sanitize_table_name(user.id, file.filename)
            ).first()

            # File-count limit: free plan caps at 5 files, pro plan is unlimited (still bounded by storage quota below)
            if user.plan == "free" and not existing:
                current_file_count = db.query(UserFile).filter(UserFile.user_id == user.id).count()
                if current_file_count >= MAX_FILES_FREE:
                    return {
                        "success": False,
                        "error": (
                            f"Free plan is limited to {MAX_FILES_FREE} files — you already have {current_file_count}. "
                            f"Delete an old file or upgrade to Pro for unlimited files."
                        ),
                        "action": "upgrade_or_delete"
                    }

            projected_used = user.storage_used_mb - (existing.size_mb if existing else 0) + size_mb
            if projected_used > user.storage_quota_mb:
                return {
                    "success": False,
                    "error": (
                        f"Storage quota exceeded — this file needs {size_mb} MB but you only have "
                        f"{round(user.storage_quota_mb - user.storage_used_mb, 1)} MB free of your "
                        f"{user.storage_quota_mb} MB {user.plan} plan. Delete an old file or upgrade your plan."
                    ),
                    "action": "upgrade_or_delete"
                }
            table_name = sanitize_table_name(user.id, file.filename)
        else:
            table_name = "user_data"

        result = load_file_to_db(temp_path, table_name=table_name)

        if user is not None:
            if existing:
                existing.original_filename = file.filename
                existing.size_mb = size_mb
                existing.rows = result["rows_loaded"]
                existing.columns_json = str(result["columns"])
            else:
                db.add(UserFile(
                    user_id=user.id, original_filename=file.filename, table_name=table_name,
                    size_mb=size_mb, rows=result["rows_loaded"], columns_json=str(result["columns"])
                ))
            db.commit()
            recompute_storage(user, db)

        storage_info = None
        if user is not None:
            storage_info = {"used_mb": round(user.storage_used_mb, 2), "quota_mb": user.storage_quota_mb}

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
            "summary"    : result["summary"],
            "storage"    : storage_info
        }
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/files")
def list_files(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    files = get_user_files(user, db)
    return {
        "files": [{
            "filename": f.original_filename, "table_name": f.table_name,
            "rows": f.rows, "size_mb": f.size_mb, "uploaded_at": f.uploaded_at.isoformat()
        } for f in files],
        "storage_used_mb": round(user.storage_used_mb, 2),
        "storage_quota_mb": user.storage_quota_mb,
        "file_count": len(files),
        "max_files": None if user.plan != "free" else MAX_FILES_FREE,
        "plan": user.plan
    }


@app.delete("/files/{table_name}")
def delete_file(table_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(UserFile).filter(UserFile.user_id == user.id, UserFile.table_name == table_name).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with engine.connect() as conn:
            conn.execute(sqltext(f'DROP TABLE IF EXISTS "{table_name}"'))
            conn.commit()
    except Exception:
        traceback.print_exc()
    db.delete(record)
    db.commit()
    recompute_storage(user, db)
    return {"success": True, "storage_used_mb": round(user.storage_used_mb, 2), "storage_quota_mb": user.storage_quota_mb}


@app.post("/upload-multiple")
async def upload_multiple_files(
    files: list[UploadFile] = File(...),
    merge: bool = True
):
    from backend.file_uploader import load_multiple_files
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


@app.post("/query")
def query(req: QueryRequest, authorization: Optional[str] = Header(default=None),
          db: Session = Depends(get_db)):
    user = get_optional_user(authorization, db)
    if user is not None and user.query_count >= FREE_QUERY_LIMIT:
        raise HTTPException(status_code=403, detail={
            "message": "Free demo limit reached",
            "queries_used": user.query_count,
            "limit": FREE_QUERY_LIMIT,
            "action": "download_local"
        })

    q = req.question
    allowed_tables = None
    primary_table = None
    matched_file = None

    if user is not None:
        user = sync_subscription_status(user, db)
        files = get_user_files(user, db)
        if not files:
            return {
                "question": q, "sql": "", "result": {"columns": [], "rows": []},
                "error": "You haven't uploaded any files yet — upload a CSV first."
            }
        allowed_tables = [f.table_name for f in files]
        primary_table = detect_target_table(q, files)
        if primary_table:
            matched_file = next((f.original_filename for f in files if f.table_name == primary_table), None)
    else:
        # anonymous/demo — only ever allowed to touch the shared demo table
        allowed_tables = ["user_data"]
        primary_table = "user_data"

    try:
        rag_examples = get_similar_examples(q, n=3)
        prompt       = build_prompt(q, rag_examples, table_names=allowed_tables, primary_table=primary_table)
        sql          = get_sql_from_llm(prompt)

        if not is_within_allowed_tables(sql, allowed_tables):
            return {
                "question": q, "sql": sql, "result": {"columns": [], "rows": []},
                "error": "That query tried to access a table outside your account — try rephrasing or check the file name."
            }

        result = execute_with_retry(sql, q)
        if user is not None:
            user.query_count += 1
            db.commit()
        return {
            "question": q, "sql": sql, "result": result,
            "matched_file": matched_file,
            "query_count": user.query_count if user is not None else None,
            "limit": FREE_QUERY_LIMIT
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "question": req.question,
            "sql"     : "",
            "result"  : {"columns": [], "rows": []},
            "error"   : str(e)
        }


@app.post("/batch")
def batch_query(req: BatchRequest):
    from backend.batch_handler import run_batch
    if not req.questions:
        return {"error": "No questions provided"}
    if len(req.questions) > 15:
        return {"error": "Max 15 questions per batch"}
    results = run_batch(req.questions)
    success = sum(1 for r in results if r["status"] == "success")
    return {"total": len(results), "success": success,
            "failed": len(results)-success, "results": results}


@app.post("/dax")
def dax_query(req: QueryRequest):
    from backend.dax_builder import generate_dax
    dax = generate_dax(req.question)
    return {
        "question"    : req.question,
        "dax"         : dax,
        "instructions": [
            "1. Open Power BI Desktop",
            "2. Home → Get Data → Text/CSV",
            "3. Modeling tab → New Measure",
            "4. Paste the DAX code → Enter",
            "5. Drag measure onto chart"
        ]
    }


@app.post("/chart")
def chart(req: ChartRequest, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    from backend.charts import generate_chart
    try:
        table = resolve_table_name(req.table, authorization, db)
        result = generate_chart(req.instruction, table, req.previous_spec, chart_type_override=req.chart_type)
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/clean")
def clean_data(req: CleanRequest, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        import pandas as pd
        from sqlalchemy import text
        from backend.data_quality import auto_clean, detect_issues
        table = resolve_table_name(req.table, authorization, db)
        df       = pd.read_sql(f'SELECT * FROM "{table}"', engine)
        df_clean = auto_clean(df, req.actions)
        with engine.connect() as conn:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}"'))
            conn.commit()
        df_clean.to_sql(table, engine, if_exists="replace",
                        index=False, method="multi")
        remaining = detect_issues(df_clean)
        return {
            "success"         : True,
            "rows_before"     : len(df),
            "rows_after"      : len(df_clean),
            "rows_removed"    : len(df) - len(df_clean),
            "remaining_issues": remaining
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.get("/eda")
def eda_report(table: str = "user_data", authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        import pandas as pd
        from backend.eda_generator import generate_eda, generate_local_narrative
        table = resolve_table_name(table, authorization, db)
        df    = pd.read_sql(f'SELECT * FROM "{table}"', engine)
        eda   = generate_eda(df, filename=table)
        # Narrative is generated 100% locally — no dataset content is ever sent to Groq/any LLM for this feature
        eda["narrative"] = generate_local_narrative(eda)
        return eda
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


@app.get("/schema-details")
def schema_details(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        from sqlalchemy import inspect, text
        user = get_optional_user(authorization, db)
        if user is not None:
            allowed = set(f.table_name for f in get_user_files(user, db))
        else:
            allowed = {"user_data"}
        inspector = inspect(engine)
        tables    = {}
        for table in inspector.get_table_names():
            if table not in allowed:
                continue
            cols     = inspector.get_columns(table)
            pk_cols  = inspector.get_pk_constraint(table)
            fk_cols  = inspector.get_foreign_keys(table)
            pk_names = pk_cols.get("constrained_columns", [])
            fk_names = {
                fk["constrained_columns"][0]: fk["referred_table"]
                for fk in fk_cols if fk["constrained_columns"]
            }
            columns = []
            for c in cols:
                col_name = c["name"]
                col_type = str(c["type"])
                is_pk    = col_name in pk_names
                fk_ref   = fk_names.get(col_name)
                n = col_name.lower()
                t = col_type.lower()
                if is_pk: role = "🔑 Primary Key"
                elif fk_ref: role = f"🔗 FK → {fk_ref}"
                elif any(w in n for w in ["date","time","month","year"]): role = "📅 Date"
                elif any(w in n for w in ["id","code","key"]): role = "🆔 Identifier"
                elif t in ["integer","bigint","numeric","float"]:
                    role = "💰 Measure" if any(w in n for w in ["sale","revenue","amount","price","total"]) else "🔢 Numeric"
                else:
                    role = "🏷️ Category" if any(w in n for w in ["product","category","type","name"]) else "📝 Text"
                columns.append({"name": col_name, "type": col_type,
                                "is_pk": is_pk, "fk_ref": fk_ref, "role": role})
            measures   = [c for c in columns if "Measure" in c["role"]]
            dimensions = [c for c in columns if c["role"] in ["🏷️ Category","🌍 Dimension","📅 Date"]]
            if len(measures) >= 2 and len(dimensions) >= 2:
                schema_type = "⭐ Star Schema"
                schema_note = f"Fact: {table} | Dimensions: {', '.join([d['name'] for d in dimensions[:4]])}"
            elif len(measures) == 1:
                schema_type = "📊 Simple Fact Table"
                schema_note = f"One measure: {measures[0]['name']}"
            else:
                schema_type = "📄 Flat Table"
                schema_note = "General purpose table"
            tables[table] = {"columns": columns, "schema_type": schema_type,
                             "schema_note": schema_note, "row_count": 0}
        with engine.connect() as conn:
            for table in tables:
                try:
                    count = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
                    tables[table]["row_count"] = count
                except Exception:
                    pass
        return {"tables": tables}
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}


@app.post("/predict")
def predict(req: PredictRequest, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        import pandas as pd
        from backend.predictor import detect_time_series, run_forecast, generate_local_forecast_narrative
        table = resolve_table_name(req.table, authorization, db)
        df = pd.read_sql(f'SELECT * FROM "{table}"', engine)
        if req.date_col and req.value_col:
            date_col, value_col = req.date_col, req.value_col
        else:
            detected = detect_time_series(df)
            if not detected["detected"]:
                return {"success": False, "error": "No date column found."}
            date_col  = detected["date_col"]
            value_col = detected["value_col"]
        result = run_forecast(df, date_col, value_col, req.periods)
        if not result.get("success"):
            return result
        stats  = result["stats"]
        # Narrative is generated 100% locally — no dataset content is ever sent to Groq/any LLM for this feature
        result["narrative"] = generate_local_forecast_narrative(value_col, date_col, result["method"], stats)
        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/automl")
def automl(req: AutoMLRequest, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        import pandas as pd
        from backend.automl import analyze_dataset, ask_ollama_for_recommendation, run_automl, generate_local_automl_narrative
        from backend.data_quality import auto_clean, detect_issues
        table = resolve_table_name(req.table, authorization, db)
        df = pd.read_sql(f'SELECT * FROM "{table}"', engine)
        cleaned = 0
        if req.clean_first:
            issues  = detect_issues(df)
            df      = auto_clean(df, issues)
            cleaned = len(issues)
        info = analyze_dataset(df)
        if req.target_col and req.target_col in df.columns:
            if req.target_col not in info["potential_targets"]:
                info["potential_targets"].insert(0, req.target_col)
        recommendation = ask_ollama_for_recommendation(info)
        ml_result = run_automl(df, recommendation, target_accuracy=req.target_accuracy)
        if "error" in ml_result:
            return {"success": False, "error": ml_result["error"],
                    "recommendation": recommendation, "dataset_info": info}
        best  = ml_result.get("best_model", "Unknown")
        acc   = ml_result.get("best_accuracy_pct", "N/A")
        feats = ml_result.get("feature_importance", [])[:3]
        # Narrative is generated 100% locally — no dataset content is ever sent to Groq/any LLM for this feature
        narrative = generate_local_automl_narrative(best, acc, feats)
        return {"success": True, "cleaned_issues": cleaned, "dataset_info": info,
                "recommendation": recommendation, "ml_result": ml_result, "narrative": narrative}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/download-pbi-template")
def download_pbi_template(req: PBITemplateRequest, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    try:
        from backend.pbi_template import generate_professional_pbit
        from backend.dax_builder  import get_user_data_columns, generate_all_dax_measures
        table        = resolve_table_name(req.table_name, authorization, db)
        cols         = get_user_data_columns(table)
        dax_measures = generate_all_dax_measures(table=table, cols=cols)
        pbit_bytes   = generate_professional_pbit(
            table_name=table, columns=cols["all_cols"], dax_measures=dax_measures)
        return Response(content=pbit_bytes, media_type="application/octet-stream",
                        headers={"Content-Disposition": "attachment; filename=AI_Dashboard.pbit"})
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}
    
app.mount("/", StaticFiles(directory="static", html=True), name="static")
