# backend/database.py
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os
load_dotenv()

DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:"
    f"{os.getenv('DB_PASSWORD')}@"
    f"{os.getenv('DB_HOST')}:"
    f"{os.getenv('DB_PORT')}/"
    f"{os.getenv('DB_NAME')}"
)

engine = create_engine(DB_URL)

def run_query(sql: str):
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        cols = list(result.keys())
        rows = [dict(zip(cols, row)) for row in result.fetchall()]
        return {"columns": cols, "rows": rows}