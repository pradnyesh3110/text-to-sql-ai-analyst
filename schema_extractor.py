# backend/schema_extractor.py
from sqlalchemy import inspect
from backend.database import engine

def get_schema_text() -> str:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    parts = []

    for table in tables:
        cols = inspector.get_columns(table)
        col_str = ", ".join(
            f"{c['name']} ({str(c['type'])})"
            for c in cols
        )
        parts.append(f'Table: "{table}"\nColumns: {col_str}')

    return "\n\n".join(parts)