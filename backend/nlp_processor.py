# backend/nlp_processor.py
import re

ABBREVIATIONS = {
    "qty"   : "quantity",
    "amt"   : "amount",
    "rev"   : "revenue",
    "prod"  : "product",
    "cat"   : "category",
    "avg"   : "average",
    "max"   : "maximum",
    "min"   : "minimum",
    "cnt"   : "count",
    "yr"    : "year",
    "mth"   : "month",
    "wk"    : "week",
    "pct"   : "percentage",
    "dept"  : "department",
    "emp"   : "employee",
    "cust"  : "customer",
    "ord"   : "order",
    "inv"   : "invoice",
    "tot"   : "total",
    "num"   : "number",
    "val"   : "value",
    "sal"   : "salary",
    "tx"    : "transaction",
    "mgr"   : "manager",
    "addr"  : "address",
    "yoy"   : "year over year",
    "mom"   : "month over month",
    "ytd"   : "year to date",
    "mtd"   : "month to date",
    "b2b"   : "business to business",
    "b2c"   : "business to consumer",
}

def preprocess_question(question: str) -> str:
    if not question:
        return question

    # Step 1: strip whitespace
    question = question.strip()
    question = re.sub(r'\s+', ' ', question)

    # Step 2: expand abbreviations
    words    = question.lower().split()
    expanded = [ABBREVIATIONS.get(w, w) for w in words]
    question = ' '.join(expanded)

    # Step 3: remove special chars (keep ? . , letters numbers)
    question = re.sub(r"[^a-zA-Z0-9\s\?\.,\-]", " ", question)
    question = re.sub(r'\s+', ' ', question).strip()

    return question


def extract_intent(question: str) -> dict:
    """
    Detect intent from question for better SQL generation
    """
    q = question.lower()

    intent = {
        "type"     : "select",
        "aggregate": None,
        "groupby"  : False,
        "orderby"  : False,
        "limit"    : None,
        "timeframe": None
    }

    # aggregate
    if any(w in q for w in ["total","sum","revenue","amount"]):
        intent["aggregate"] = "SUM"
    elif any(w in q for w in ["average","avg","mean"]):
        intent["aggregate"] = "AVG"
    elif any(w in q for w in ["count","how many","number of"]):
        intent["aggregate"] = "COUNT"
    elif any(w in q for w in ["maximum","highest","max","best","top"]):
        intent["aggregate"] = "MAX"
    elif any(w in q for w in ["minimum","lowest","min","worst"]):
        intent["aggregate"] = "MIN"

    # groupby
    if any(w in q for w in ["by","each","per","group","breakdown"]):
        intent["groupby"] = True

    # ordering
    if any(w in q for w in ["top","highest","lowest","best","worst","rank"]):
        intent["orderby"] = True

    # limit
    for n in ["3","5","10","20"]:
        if f"top {n}" in q or f"{n} highest" in q:
            intent["limit"] = int(n)
            break

    # timeframe
    if "today" in q:     intent["timeframe"] = "today"
    elif "week" in q:    intent["timeframe"] = "week"
    elif "month" in q:   intent["timeframe"] = "month"
    elif "year" in q:    intent["timeframe"] = "year"
    elif "quarter" in q: intent["timeframe"] = "quarter"

    return intent