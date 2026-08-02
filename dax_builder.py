# backend/dax_builder.py
import re
import os
import requests
from dotenv import load_dotenv
load_dotenv()

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# ── Pre-built DAX templates ─────────────────────
# Instead of asking LLM to write DAX from scratch
# we match the question to a template and fill in columns
# This gives 100% correct DAX every time

TEMPLATES = {
    "sum_by_category": {
        "keywords" : ["by product","by category","by region",
                      "by department","by type","each product",
                      "each category","each region","per product",
                      "per category","per region"],
        "dax"      : """[MEASURE_NAME] =
CALCULATE(
    SUM([TABLE][[VALUE_COL]]),
    ALLEXCEPT([TABLE], [TABLE][[GROUP_COL]])
)""",
        "chart"    : "bar"
    },
    "total": {
        "keywords" : ["total","sum","overall","grand total",
                      "how much","revenue","all sales"],
        "dax"      : """[MEASURE_NAME] =
SUM([TABLE][[VALUE_COL]])""",
        "chart"    : "card"
    },
    "monthly_trend": {
        "keywords" : ["month","monthly","by month","per month",
                      "month over month","mom"],
        "dax"      : """[MEASURE_NAME] =
CALCULATE(
    SUM([TABLE][[VALUE_COL]]),
    DATESMTD([TABLE][[DATE_COL]])
)""",
        "chart"    : "line"
    },
    "yearly_trend": {
        "keywords" : ["year","yearly","annual","by year",
                      "per year","year over year","yoy"],
        "dax"      : """[MEASURE_NAME] =
CALCULATE(
    SUM([TABLE][[VALUE_COL]]),
    DATESYTD([TABLE][[DATE_COL]])
)""",
        "chart"    : "line"
    },
    "trend_by_date": {
        "keywords" : ["trend","over time","date","daily",
                      "timeline","growth","by date"],
        "dax"      : """[MEASURE_NAME] =
CALCULATE(
    SUM([TABLE][[VALUE_COL]]),
    ALLEXCEPT([TABLE], [TABLE][[DATE_COL]])
)""",
        "chart"    : "line"
    },
    "average": {
        "keywords" : ["average","avg","mean"],
        "dax"      : """[MEASURE_NAME] =
AVERAGE([TABLE][[VALUE_COL]])""",
        "chart"    : "card"
    },
    "count": {
        "keywords" : ["count","how many","number of",
                      "total count","distinct"],
        "dax"      : """[MEASURE_NAME] =
DISTINCTCOUNT([TABLE][[GROUP_COL]])""",
        "chart"    : "card"
    },
    "top_n": {
        "keywords" : ["top","highest","best","maximum",
                      "most","largest","rank"],
        "dax"      : """[MEASURE_NAME] =
MAXX(
    TOPN(
        1,
        SUMMARIZE(
            [TABLE],
            [TABLE][[GROUP_COL]],
            "val", SUM([TABLE][[VALUE_COL]])
        ),
        [val], DESC
    ),
    [TABLE][[GROUP_COL]]
)""",
        "chart"    : "bar"
    },
    "bottom_n": {
        "keywords" : ["bottom","lowest","worst","minimum",
                      "least","smallest"],
        "dax"      : """[MEASURE_NAME] =
MAXX(
    TOPN(
        1,
        SUMMARIZE(
            [TABLE],
            [TABLE][[GROUP_COL]],
            "val", SUM([TABLE][[VALUE_COL]])
        ),
        [val], ASC
    ),
    [TABLE][[GROUP_COL]]
)""",
        "chart"    : "bar"
    },
    "percentage": {
        "keywords" : ["percentage","percent","share",
                      "proportion","distribution","breakdown"],
        "dax"      : """[MEASURE_NAME] =
DIVIDE(
    SUM([TABLE][[VALUE_COL]]),
    CALCULATE(
        SUM([TABLE][[VALUE_COL]]),
        ALL([TABLE])
    ),
    0
) * 100""",
        "chart"    : "pie"
    },
    "growth": {
        "keywords" : ["growth","increase","change",
                      "difference","variance","compare"],
        "dax"      : """[MEASURE_NAME] =
VAR current_val =
    SUM([TABLE][[VALUE_COL]])
VAR previous_val =
    CALCULATE(
        SUM([TABLE][[VALUE_COL]]),
        DATEADD([TABLE][[DATE_COL]], -1, MONTH)
    )
RETURN
    DIVIDE(
        current_val - previous_val,
        previous_val,
        0
    ) * 100""",
        "chart"    : "line"
    }
}


def detect_columns_from_schema(schema: str) -> dict:
    """
    Extract column names from schema
    Returns: value_col, group_col, date_col
    """
    columns = []
    for line in schema.split('\n'):
        if 'Columns:' in line:
            col_part = line.split('Columns:')[1]
            for col_str in col_part.split(','):
                col_name = col_str.strip().split('(')[0].strip()
                columns.append(col_name)

    value_col = "value"
    group_col = "category"
    date_col  = "date"

    for col in columns:
        c = col.lower()
        # numeric/value columns
        if any(w in c for w in [
            "sale","revenue","amount","price",
            "cost","profit","qty","quantity",
            "total","value","income","expense"
        ]):
            value_col = col

        # grouping columns
        if any(w in c for w in [
            "product","category","region","department",
            "type","name","group","class","segment"
        ]):
            group_col = col

        # date columns
        if any(w in c for w in [
            "date","time","month","year",
            "period","day","week","timestamp"
        ]):
            date_col = col

    return {
        "value_col": value_col,
        "group_col": group_col,
        "date_col" : date_col,
        "all_cols" : columns
    }


def match_template(question: str) -> dict:
    """
    Match question to best DAX template
    Returns template dict
    """
    q = question.lower()

    # score each template
    scores = {}
    for key, template in TEMPLATES.items():
        score = sum(
            1 for kw in template["keywords"]
            if kw in q
        )
        scores[key] = score

    # get best match
    best = max(scores, key=scores.get)

    # if no match found — use sum_by_category as default
    if scores[best] == 0:
        best = "sum_by_category"

    return TEMPLATES[best], best


def build_measure_name(question: str) -> str:
    """
    Build a clean measure name from the question
    """
    # use LLM to get a short name
    stop_words = [
        "show","me","the","a","an","of","by",
        "what","is","how","many","much","which",
        "give","list","find","get","calculate"
    ]
    words = question.lower().split()
    words = [
        w.capitalize() for w in words
        if w not in stop_words
        and len(w) > 2
    ]
    name = " ".join(words[:4])
    return name if name else "My Measure"


def generate_dax(
    question   : str,
    table_name : str = "user_data"
) -> dict:
    from backend.schema_extractor import get_schema_text
    schema  = get_schema_text()
    cols    = detect_columns_from_schema(schema)
    template, template_key = match_template(question)

    # build measure name
    measure_name = build_measure_name(question)

    # fill template
    dax = template["dax"]
    dax = dax.replace("[MEASURE_NAME]", measure_name)
    dax = dax.replace("[TABLE]",        table_name)
    dax = dax.replace("[VALUE_COL]",    cols["value_col"])
    dax = dax.replace("[GROUP_COL]",    cols["group_col"])
    dax = dax.replace("[DATE_COL]",     cols["date_col"])

    chart_type = template["chart"]

    return {
        "dax"          : dax,
        "chart_type"   : chart_type,
        "chart_reason" : get_chart_reason(chart_type),
        "pbi_visual"   : get_pbi_visual(chart_type),
        "template_used": template_key,
        "columns_used" : cols
    }


def get_chart_reason(chart_type: str) -> str:
    return {
        "line" : "Time-based → Line chart shows trends over time",
        "bar"  : "Comparison → Bar chart compares values clearly",
        "pie"  : "Proportion → Pie chart shows distribution",
        "card" : "Single value → KPI Card visual"
    }.get(chart_type, "Bar chart")


def get_pbi_visual(chart_type: str) -> str:
    return {
        "line" : "Line Chart",
        "bar"  : "Clustered Bar Chart",
        "pie"  : "Pie Chart",
        "card" : "Card Visual"
    }.get(chart_type, "Clustered Bar Chart")