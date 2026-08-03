# backend/schema_extractor.py
from sqlalchemy import inspect
from backend.database import engine

def get_schema_text(table_names: list = None) -> str:
    """If table_names is given, only describe those tables (and only the
    ones that actually exist) — used to scope a user's schema to just
    their own uploaded tables in a shared multi-tenant database."""
    inspector = inspect(engine)
    existing = inspector.get_table_names()
    tables = [t for t in table_names if t in existing] if table_names is not None else existing
    parts = []

    for table in tables:
        cols = inspector.get_columns(table)
        col_str = ", ".join(
            f"{c['name']} ({str(c['type'])})"
            for c in cols
        )
        parts.append(f'Table: "{table}"\nColumns: {col_str}')

    return "\n\n".join(parts)
