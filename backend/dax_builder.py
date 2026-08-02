# backend/dax_builder.py
import re

# Simple DAX templates — no LLM needed
DAX_TEMPLATES = {
    "total": 'Total Value = SUM("user_data"[value_col])',
    "count": 'Row Count = COUNTROWS("user_data")',
    "average": 'Average Value = AVERAGE("user_data"[value_col])',
    "max": 'Max Value = MAX("user_data"[value_col])',
    "min": 'Min Value = MIN("user_data"[value_col])',
}

def generate_dax(question: str) -> str:
    """Generate DAX from question using simple templates."""
    q = question.lower()
    
    if any(w in q for w in ["total", "sum", "all"]):
        return DAX_TEMPLATES["total"]
    elif any(w in q for w in ["count", "how many", "number of"]):
        return DAX_TEMPLATES["count"]
    elif any(w in q for w in ["average", "avg", "mean"]):
        return DAX_TEMPLATES["average"]
    elif any(w in q for w in ["max", "maximum", "highest"]):
        return DAX_TEMPLATES["max"]
    elif any(w in q for w in ["min", "minimum", "lowest"]):
        return DAX_TEMPLATES["min"]
    
    return DAX_TEMPLATES["count"]  # default

def get_user_data_columns():
    """Get columns from user_data table."""
    from sqlalchemy import inspect
    from backend.database import engine
    
    inspector = inspect(engine)
    try:
        cols = inspector.get_columns("user_data")
        return {
            "all_cols": [c["name"] for c in cols],
            "numeric_cols": [c["name"] for c in cols if "int" in str(c["type"]).lower() or "float" in str(c["type"]).lower()],
            "text_cols": [c["name"] for c in cols if "varchar" in str(c["type"]).lower() or "text" in str(c["type"]).lower()]
        }
    except:
        return {"all_cols": [], "numeric_cols": [], "text_cols": []}

def generate_all_dax_measures(table: str, cols: dict):
    """Generate all DAX measures for the table."""
    measures = []
    for col in cols.get("numeric_cols", []):
        measures.append(f'{col} Total = SUM("{table}"[{col}])')
        measures.append(f'{col} Average = AVERAGE("{table}"[{col}])')
    return measures