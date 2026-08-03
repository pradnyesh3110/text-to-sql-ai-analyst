# backend/charts.py
"""
Chat-driven chart spec generation — bar, line, pie, doughnut.

Same discipline as SQL generation, split into three steps:
  1. LLM sees ONLY column names/types + the user's instruction — never row data.
     It returns a small JSON spec (chart type, which columns, sort, color).
  2. That spec is validated against the real schema (reject hallucinated
     columns, unknown chart types, unsafe values).
  3. The actual aggregation runs locally via normal SQL — real numbers
     never touch the LLM at any point.
"""
import json
import re
from sqlalchemy import text as sqltext
from backend.database import engine
from backend.schema_extractor import get_schema_text
from backend.llm_client import get_sql_from_llm

DEFAULT_COLOR = "#6d28d9"
VALID_CHART_TYPES = ("bar", "line", "pie", "doughnut")
VALID_AGGS = ("sum", "avg", "count", "min", "max")

# A small, fixed palette for multi-slice charts (pie/doughnut) — generated
# locally, never left to the LLM to pick, since "one color per column
# name" is a formatting decision, not something that needs a model.
PALETTE = ["#6d28d9", "#ff6b4a", "#22c55e", "#f59e0b", "#0ea5e9",
           "#e11d48", "#8b5cf6", "#14b8a6", "#eab308", "#ec4899"]


def build_chart_prompt(instruction: str, table_name: str, previous_spec: dict = None) -> str:
    schema = get_schema_text([table_name])
    context = f"\nCurrent chart settings: {json.dumps(previous_spec)}" if previous_spec else ""

    return f"""You are a charting assistant. Based on the table schema and the user's
instruction, return ONLY a JSON object describing a chart — nothing else,
no markdown, no explanation.

TABLE SCHEMA:
{schema}
{context}

USER INSTRUCTION: {instruction}

Return exactly this JSON shape:
{{
  "chart_type": "bar, line, pie, or doughnut — pick whichever best fits the instruction",
  "x_column": "column name to group by (must exist in schema)",
  "y_column": "numeric column to aggregate (must exist in schema)",
  "agg": "sum, avg, count, min, or max",
  "sort": "asc, desc, or none",
  "limit": integer between 1 and 50,
  "color": "a hex color code, e.g. #6d28d9",
  "title": "short chart title"
}}

JSON:"""


def parse_chart_spec(raw: str) -> dict:
    raw = raw.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.lower().startswith("json"):
            raw = raw[4:]
    start, end = raw.find("{"), raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("Model did not return JSON")
    return json.loads(raw[start:end])


def validate_spec(spec: dict, table_name: str, chart_type_override: str = None) -> dict:
    """Defense-in-depth: only allow columns that actually exist on this
    table, and only safe, whitelisted values for every other field —
    this spec eventually gets interpolated into SQL, so it must never
    contain anything the LLM invented outside a known-safe set."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    valid_cols = {c["name"] for c in inspector.get_columns(table_name)}

    x_col = spec.get("x_column")
    y_col = spec.get("y_column")
    if x_col not in valid_cols:
        raise ValueError(f'Column "{x_col}" doesn\'t exist on this table.')
    if y_col not in valid_cols:
        raise ValueError(f'Column "{y_col}" doesn\'t exist on this table.')

    # An explicit type from the UI's type picker always wins over whatever
    # the LLM inferred from the instruction text — deterministic, not guessed.
    chart_type = str(chart_type_override or spec.get("chart_type", "bar")).lower()
    if chart_type not in VALID_CHART_TYPES:
        chart_type = "bar"

    agg = str(spec.get("agg", "sum")).lower()
    if agg not in VALID_AGGS:
        agg = "sum"

    sort = str(spec.get("sort", "desc")).lower()
    if sort not in ("asc", "desc", "none"):
        sort = "desc"

    try:
        limit = int(spec.get("limit", 15))
    except (TypeError, ValueError):
        limit = 15
    # pie/doughnut get unreadable past ~10 slices — cap tighter for those
    max_limit = 10 if chart_type in ("pie", "doughnut") else 50
    limit = max(1, min(limit, max_limit))

    color = spec.get("color") or DEFAULT_COLOR
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(color)):
        color = DEFAULT_COLOR

    title = str(spec.get("title") or f"{y_col} by {x_col}")[:100]

    return {
        "chart_type": chart_type, "x_column": x_col, "y_column": y_col, "agg": agg,
        "sort": sort, "limit": limit, "color": color, "title": title
    }


def run_chart_query(spec: dict, table_name: str) -> dict:
    """Runs the validated spec as a normal aggregation query. This is
    where real data exists — it never goes near the LLM, only back to
    the requesting user."""
    agg_sql = {"sum": "SUM", "avg": "AVG", "count": "COUNT", "min": "MIN", "max": "MAX"}[spec["agg"]]
    order = "" if spec["sort"] == "none" else f'ORDER BY agg_value {spec["sort"].upper()}'

    sql = f'''
        SELECT "{spec["x_column"]}" AS label, {agg_sql}("{spec["y_column"]}") AS agg_value
        FROM "{table_name}"
        GROUP BY "{spec["x_column"]}"
        {order}
        LIMIT {spec["limit"]}
    '''
    with engine.connect() as conn:
        rows = conn.execute(sqltext(sql)).fetchall()

    labels = [str(r[0]) for r in rows]
    values = [float(r[1]) if r[1] is not None else 0 for r in rows]

    result = {"labels": labels, "values": values}
    if spec["chart_type"] in ("pie", "doughnut"):
        # multi-slice charts need one color per slice, built locally from the fixed palette
        result["colors"] = [PALETTE[i % len(PALETTE)] for i in range(len(labels))]
    return result


def generate_chart(instruction: str, table_name: str, previous_spec: dict = None, chart_type_override: str = None) -> dict:
    prompt = build_chart_prompt(instruction, table_name, previous_spec)
    raw = get_sql_from_llm(prompt)
    spec = parse_chart_spec(raw)
    spec = validate_spec(spec, table_name, chart_type_override)
    data = run_chart_query(spec, table_name)
    return {"spec": spec, "data": data}