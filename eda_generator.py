# backend/eda_generator.py
import pandas as pd
import numpy as np
from datetime import datetime

def generate_eda(df: pd.DataFrame, filename: str = "dataset") -> dict:

    report = {
        "filename"    : filename,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "overview"    : {},
        "columns"     : [],
        "correlations": [],
        "insights"    : []
    }

    # ── 1. Overview ─────────────────────────────
    report["overview"] = {
        "total_rows"     : len(df),
        "total_columns"  : len(df.columns),
        "total_cells"    : len(df) * len(df.columns),
        "missing_cells"  : int(df.isna().sum().sum()),
        "missing_pct"    : round(
            df.isna().sum().sum() /
            (len(df) * len(df.columns)) * 100, 2
        ),
        "duplicate_rows" : int(df.duplicated().sum()),
        "memory_kb"      : round(
            df.memory_usage(deep=True).sum() / 1024, 2
        ),
        "numeric_columns": len(
            df.select_dtypes(include=[np.number]).columns
        ),
        "text_columns"   : len(
            df.select_dtypes(include=["object"]).columns
        ),
        "date_columns"   : len([
            c for c in df.columns
            if any(w in c.lower()
                   for w in ["date","time","month","year"])
        ])
    }

    # ── 2. Column Analysis ───────────────────────
    for col in df.columns:
        info = {
            "name"       : col,
            "dtype"      : str(df[col].dtype),
            "total"      : len(df),
            "missing"    : int(df[col].isna().sum()),
            "missing_pct": round(
                df[col].isna().sum() / len(df) * 100, 2
            ),
            "unique"     : int(df[col].nunique()),
            "unique_pct" : round(
                df[col].nunique() / len(df) * 100, 2
            )
        }

        if df[col].dtype in ["int64","float64"]:
            info["type"]   = "numeric"
            info["min"]    = safe(df[col].min())
            info["max"]    = safe(df[col].max())
            info["mean"]   = safe(df[col].mean())
            info["median"] = safe(df[col].median())
            info["std"]    = safe(df[col].std())
            info["q25"]    = safe(df[col].quantile(0.25))
            info["q75"]    = safe(df[col].quantile(0.75))

            # outliers
            q1  = df[col].quantile(0.25)
            q3  = df[col].quantile(0.75)
            iqr = q3 - q1
            info["outliers"] = int((
                (df[col] < q1 - 1.5*iqr) |
                (df[col] > q3 + 1.5*iqr)
            ).sum())

            # skewness
            try:
                skew = float(df[col].skew())
                info["skewness"] = round(skew, 2)
                info["shape"]    = (
                    "right-skewed" if skew > 0.5 else
                    "left-skewed"  if skew < -0.5 else
                    "normal"
                )
            except Exception:
                info["skewness"] = 0
                info["shape"]    = "normal"

            # top values
            info["top_values"] = (
                df[col].value_counts().head(5)
                .reset_index()
                .rename(columns={col:"value","count":"freq"})
                .to_dict(orient="records")
            )

        else:
            info["type"] = "text"
            top = df[col].value_counts().head(5)
            info["top_values"] = [
                {"value": str(v), "freq": int(f)}
                for v, f in top.items()
            ]
            info["sample_values"] = [
                str(v) for v in df[col].dropna().unique()[:5]
            ]

        report["columns"].append(info)

    # ── 3. Correlations ──────────────────────────
    num_cols = df.select_dtypes(
        include=[np.number]
    ).columns.tolist()

    if len(num_cols) >= 2:
        corr   = df[num_cols].corr()
        corrs  = []
        for i in range(len(num_cols)):
            for j in range(i+1, len(num_cols)):
                val = corr.iloc[i, j]
                if not np.isnan(val):
                    corrs.append({
                        "col1"       : num_cols[i],
                        "col2"       : num_cols[j],
                        "correlation": round(float(val), 3),
                        "strength"   : (
                            "strong"   if abs(val) > 0.7 else
                            "moderate" if abs(val) > 0.4 else
                            "weak"
                        ),
                        "direction"  : (
                            "positive" if val > 0 else "negative"
                        )
                    })
        report["correlations"] = sorted(
            corrs,
            key=lambda x: abs(x["correlation"]),
            reverse=True
        )[:10]

    # ── 4. Auto Insights ─────────────────────────
    insights = []

    # missing
    high_miss = [
        c for c in report["columns"]
        if c["missing_pct"] > 20
    ]
    if high_miss:
        cols = ", ".join([c["name"] for c in high_miss])
        insights.append({
            "type"   : "warning",
            "icon"   : "⚠️",
            "message": f"High missing values in: {cols} — consider imputation"
        })

    # duplicates
    if report["overview"]["duplicate_rows"] > 0:
        insights.append({
            "type"   : "warning",
            "icon"   : "🔁",
            "message": f"{report['overview']['duplicate_rows']} duplicate rows found — remove before analysis"
        })

    # outliers
    for c in [c for c in report["columns"]
              if c.get("outliers", 0) > 0][:3]:
        insights.append({
            "type"   : "info",
            "icon"   : "📍",
            "message": f"'{c['name']}' has {c['outliers']} outliers — investigate or cap values"
        })

    # skewness
    for c in [c for c in report["columns"]
              if c.get("shape") in [
                  "right-skewed","left-skewed"
              ]][:2]:
        insights.append({
            "type"   : "info",
            "icon"   : "📊",
            "message": f"'{c['name']}' is {c['shape']} (skew={c['skewness']}) — consider log transform"
        })

    # strong correlations
    for c in [c for c in report["correlations"]
              if c["strength"] == "strong"][:2]:
        insights.append({
            "type"   : "insight",
            "icon"   : "🔗",
            "message": f"Strong {c['direction']} correlation ({c['correlation']}) between '{c['col1']}' and '{c['col2']}'"
        })

    # good data
    if report["overview"]["missing_pct"] < 5:
        insights.append({
            "type"   : "success",
            "icon"   : "✅",
            "message": f"Good data quality — only {report['overview']['missing_pct']}% missing values"
        })

    # size
    rows = report["overview"]["total_rows"]
    insights.append({
        "type"   : "info",
        "icon"   : "📋",
        "message": (
            f"Small dataset ({rows} rows) — quick analysis suitable"
            if rows < 1000 else
            f"Medium dataset ({rows} rows) — good for ML models"
            if rows < 100000 else
            f"Large dataset ({rows:,} rows) — consider sampling"
        )
    })

    report["insights"] = insights
    return report


def safe(val):
    try:
        if pd.isna(val):
            return None
        return round(float(val), 2)
    except Exception:
        return None


def get_eda_summary_for_llm(eda: dict) -> str:
    lines = [
        f"Dataset: {eda['filename']}",
        f"Rows: {eda['overview']['total_rows']}",
        f"Columns: {eda['overview']['total_columns']}",
        f"Missing: {eda['overview']['missing_pct']}%",
        f"Duplicates: {eda['overview']['duplicate_rows']}",
        "",
        "Columns:"
    ]
    for col in eda["columns"]:
        if col["type"] == "numeric":
            lines.append(
                f"  {col['name']} (numeric): "
                f"min={col.get('min')}, max={col.get('max')}, "
                f"mean={col.get('mean')}, "
                f"missing={col['missing_pct']}%"
            )
        else:
            top = (col["top_values"][0]["value"]
                   if col["top_values"] else "N/A")
            lines.append(
                f"  {col['name']} (text): "
                f"unique={col['unique']}, "
                f"most common='{top}', "
                f"missing={col['missing_pct']}%"
            )
    if eda["correlations"]:
        lines.append("\nTop correlations:")
        for c in eda["correlations"][:3]:
            lines.append(
                f"  {c['col1']} vs {c['col2']}: "
                f"{c['correlation']} ({c['strength']})"
            )
    return "\n".join(lines)