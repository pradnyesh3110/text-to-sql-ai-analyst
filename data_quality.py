# backend/data_quality.py
import pandas as pd
import numpy as np


def detect_issues(df: pd.DataFrame) -> list:
    issues    = []
    total_rows = len(df)
    if total_rows == 0:
        return issues

    # ── 1. Missing values ──────────────────────
    for col in df.columns:
        missing = int(df[col].isna().sum())
        if missing > 0:
            pct   = round(missing / total_rows * 100, 1)
            dtype = str(df[col].dtype)

            if dtype in ["int64", "float64"]:
                median_val = df[col].median()
                suggestion = f"Fill with median ({median_val:.0f})"
            else:
                mode_val   = df[col].mode()
                fill       = mode_val[0] if len(mode_val) > 0 else "Unknown"
                suggestion = f"Fill with most common value ('{fill}')"

            issues.append({
                "type"       : "missing_values",
                "column"     : col,
                "count"      : missing,
                "percentage" : pct,
                "severity"   : "high" if pct > 30
                               else "medium" if pct > 10
                               else "low",
                "suggestion" : suggestion,
                "fix_action" : "fill_missing"
            })

    # ── 2. Duplicate rows ──────────────────────
    dupes = int(df.duplicated().sum())
    if dupes > 0:
        pct = round(dupes / total_rows * 100, 1)
        issues.append({
            "type"       : "duplicate_rows",
            "column"     : "all",
            "count"      : dupes,
            "percentage" : pct,
            "severity"   : "high" if pct > 20 else "medium",
            "suggestion" : f"Remove {dupes} duplicate rows",
            "fix_action" : "remove_duplicates"
        })

    # ── 3. Outliers (numeric only) ─────────────
    for col in df.select_dtypes(include=[np.number]).columns:
        Q1  = df[col].quantile(0.25)
        Q3  = df[col].quantile(0.75)
        IQR = Q3 - Q1
        if IQR == 0:
            continue
        lower    = Q1 - 1.5 * IQR
        upper    = Q3 + 1.5 * IQR
        outliers = int(
            ((df[col] < lower) | (df[col] > upper)).sum()
        )
        if outliers > 0:
            pct = round(outliers / total_rows * 100, 1)
            issues.append({
                "type"       : "outliers",
                "column"     : col,
                "count"      : outliers,
                "percentage" : pct,
                "severity"   : "medium",
                "suggestion" : f"Cap values between {lower:.0f} and {upper:.0f}",
                "fix_action" : "cap_outliers",
                "lower"      : lower,
                "upper"      : upper
            })

    # ── 4. Whitespace in text columns ──────────
    for col in df.select_dtypes(include=["object"]).columns:
        try:
            ws = int(df[col].str.strip().ne(df[col]).sum())
            if ws > 0:
                pct = round(ws / total_rows * 100, 1)
                issues.append({
                    "type"       : "whitespace",
                    "column"     : col,
                    "count"      : ws,
                    "percentage" : pct,
                    "severity"   : "low",
                    "suggestion" : f"Trim whitespace in '{col}'",
                    "fix_action" : "trim_whitespace"
                })
        except Exception:
            pass

    return issues


def auto_clean(df: pd.DataFrame, actions: list) -> pd.DataFrame:
    df = df.copy()

    for action in actions:
        fix = action.get("fix_action")
        col = action.get("column")

        if fix == "fill_missing" and col in df.columns:
            if df[col].dtype in ["int64", "float64"]:
                df[col].fillna(df[col].median(), inplace=True)
            else:
                mode = df[col].mode()
                fill = mode[0] if len(mode) > 0 else "Unknown"
                df[col].fillna(fill, inplace=True)

        elif fix == "remove_duplicates":
            df = df.drop_duplicates()

        elif fix == "cap_outliers" and col in df.columns:
            lower = action.get("lower")
            upper = action.get("upper")
            if lower is not None and upper is not None:
                df[col] = df[col].clip(lower=lower, upper=upper)

        elif fix == "trim_whitespace" and col in df.columns:
            try:
                df[col] = df[col].str.strip()
            except Exception:
                pass

    return df.reset_index(drop=True)


def get_data_summary(df: pd.DataFrame) -> dict:
    return {
        "total_rows"    : len(df),
        "total_columns" : len(df.columns),
        "columns"       : list(df.columns),
        "dtypes"        : {
            col: str(dtype)
            for col, dtype in df.dtypes.items()
        },
        "memory_mb"     : round(
            df.memory_usage(deep=True).sum() / 1024**2, 2
        ),
        "missing_total" : int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum())
    }