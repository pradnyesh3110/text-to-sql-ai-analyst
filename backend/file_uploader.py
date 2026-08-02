# backend/file_uploader.py
import pandas as pd
import os
import json
import re

try:
    import chardet
except ImportError:
    chardet = None

from sqlalchemy import text
from backend.database import engine
from backend.data_quality import detect_issues, get_data_summary

ALLOWED_EXTENSIONS = [
    ".csv", ".xlsx", ".xls",
    ".json", ".pdf", ".tsv", ".txt"
]


# ── Encoding detection ──────────────────────────
def detect_encoding(file_path: str) -> str:
    if chardet is None:
        return "utf-8"
    with open(file_path, "rb") as f:
        result = chardet.detect(f.read())
    return result.get("encoding", "utf-8") or "utf-8"


# ── File reader ─────────────────────────────────
def read_file(file_path: str) -> pd.DataFrame:
    ext = os.path.splitext(file_path)[1].lower()

    # ── CSV ────────────────────────────────────
    if ext == ".csv":
        encoding = detect_encoding(file_path)
        try:
            df = pd.read_csv(file_path, encoding=encoding,on_bad_lines="skip",engine="python")
        except Exception:
            df = pd.read_csv(file_path, encoding="latin-1",on_bad_lines="skip",engine="python")
        except Exception as e:
            raise ValueError(f"Could not read CSV file. "f"Please check the file format. "f"Error: {str(e)}")

        return df

    # ── Excel ──────────────────────────────────
    elif ext in [".xlsx", ".xls"]:
        xl = pd.ExcelFile(file_path)
        for sheet in xl.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet)
            if len(df) > 0:
                return df
        return pd.read_excel(file_path)

    # ── TSV / TXT ──────────────────────────────
    elif ext in [".tsv", ".txt"]:
        encoding = detect_encoding(file_path)
        try:
            df = pd.read_csv(
                file_path, sep="\t", encoding=encoding
            )
        except Exception:
            df = pd.read_csv(
                file_path, sep=",", encoding="latin-1"
            )
        return df

    # ── JSON ───────────────────────────────────
    elif ext == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, dict):
            for key in ["data", "records", "rows",
                        "results", "items"]:
                if key in data and isinstance(data[key], list):
                    df = pd.DataFrame(data[key])
                    break
            else:
                df = pd.DataFrame([data])
        else:
            raise ValueError("Unsupported JSON structure")
        return df

    # ── PDF ────────────────────────────────────
    elif ext == ".pdf":
        try:
            import pdfplumber
            dfs = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if table and len(table) > 1:
                            headers = table[0]
                            rows    = table[1:]
                            df_page = pd.DataFrame(
                                rows, columns=headers
                            )
                            dfs.append(df_page)
            if dfs:
                return pd.concat(dfs, ignore_index=True)
            else:
                raise ValueError(
                    "No tables found in PDF. "
                    "Make sure PDF has proper table formatting."
                )
        except ImportError:
            raise ValueError(
                "pdfplumber not installed. "
                "Run: pip install pdfplumber"
            )

    else:
        raise ValueError(
            f"Unsupported file type: {ext}. "
            f"Supported: {', '.join(ALLOWED_EXTENSIONS)}"
        )


# ── Clean column names ──────────────────────────
def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
        df.columns
        .astype(str)
        .str.strip()
        .str.lower()
        .str.replace(" ",  "_", regex=False)
        .str.replace(r"[^a-zA-Z0-9_]", "", regex=True)
        .str.replace(r"^(\d)", r"col_\1", regex=True)
    )

    df = df.dropna(axis=1, how="all")
    df = df.dropna(axis=0, how="all")
    df = df[[c for c in df.columns
             if not c.startswith("unnamed")]]
    df = df.reset_index(drop=True)

    return df


# ── Single file loader ──────────────────────────
def load_file_to_db(
    file_path  : str,
    table_name : str = "user_data"
) -> dict:

    ext = os.path.splitext(file_path)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file: {ext}. "
            f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    df      = read_file(file_path)
    df      = clean_dataframe(df)
    issues  = detect_issues(df)
    summary = get_data_summary(df)

    with engine.connect() as conn:
        conn.execute(
            text(f'DROP TABLE IF EXISTS "{table_name}"')
        )
        conn.commit()

    df.to_sql(
        name      = table_name,
        con       = engine,
        if_exists = "replace",
        index     = False,
        method    = "multi"
    )

    return {
        "table_name"  : table_name,
        "rows_loaded" : len(df),
        "columns"     : list(df.columns),
        "sample"      : df.head(3).to_dict(orient="records"),
        "summary"     : summary,
        "issues"      : issues,
        "issue_count" : len(issues),
        "file_type"   : ext
    }


# ── Multiple file loader ────────────────────────
def load_multiple_files(
    file_paths : list,
    merge      : bool = False
) -> dict:
    results = []
    all_dfs = []
    failed  = []

    for file_path in file_paths:
        try:
            df       = read_file(file_path)
            df       = clean_dataframe(df)
            filename = os.path.basename(file_path)
            results.append({
                "file"    : filename,
                "rows"    : len(df),
                "columns" : list(df.columns),
                "status"  : "success"
            })
            all_dfs.append((filename, df))

        except Exception as e:
            failed.append({
                "file"  : os.path.basename(file_path),
                "error" : str(e),
                "status": "failed"
            })

    if not all_dfs:
        return {
            "success": False,
            "error"  : "No files could be loaded",
            "results": failed
        }

    # ── Merge all into one table ────────────────
    if merge:
        merged = []
        for filename, df in all_dfs:
            df["_source_file"] = filename
            merged.append(df)

        combined = pd.concat(merged, ignore_index=True)
        combined = combined.fillna("")

        with engine.connect() as conn:
            conn.execute(
                text('DROP TABLE IF EXISTS "user_data"')
            )
            conn.commit()

        combined.to_sql(
            name      = "user_data",
            con       = engine,
            if_exists = "replace",
            index     = False,
            method    = "multi"
        )

        issues  = detect_issues(combined)
        summary = get_data_summary(combined)

        return {
            "success"     : True,
            "mode"        : "merged",
            "message"     : (
                f"Merged {len(all_dfs)} files — "
                f"{len(combined)} total rows"
            ),
            "table"       : "user_data",
            "rows"        : len(combined),
            "columns"     : list(combined.columns),
            "files_loaded": len(all_dfs),
            "files_failed": len(failed),
            "results"     : results + failed,
            "issues"      : issues,
            "issue_count" : len(issues),
            "summary"     : summary,
            "sample"      : combined.head(3).to_dict(
                orient="records"
            )
        }

    # ── Separate tables ─────────────────────────
    else:
        tables_created = []

        for filename, df in all_dfs:
            table_name = os.path.splitext(filename)[0]
            table_name = table_name.lower()
            table_name = re.sub(r"[^a-z0-9_]", "_", table_name)
            table_name = re.sub(r"_+", "_", table_name)
            table_name = table_name[:50]

            with engine.connect() as conn:
                conn.execute(
                    text(
                        f'DROP TABLE IF EXISTS "{table_name}"'
                    )
                )
                conn.commit()

            df.to_sql(
                name      = table_name,
                con       = engine,
                if_exists = "replace",
                index     = False,
                method    = "multi"
            )

            tables_created.append({
                "file"      : filename,
                "table_name": table_name,
                "rows"      : len(df),
                "columns"   : list(df.columns)
            })

        return {
            "success"      : True,
            "mode"         : "separate",
            "message"      : (
                f"Loaded {len(all_dfs)} files into "
                f"{len(all_dfs)} separate tables"
            ),
            "tables"       : tables_created,
            "files_loaded" : len(all_dfs),
            "files_failed" : len(failed),
            "results"      : results + failed,
            "issues"       : [],
            "issue_count"  : 0
        }