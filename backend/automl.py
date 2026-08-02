# backend/automl.py
import pandas as pd
import numpy as np
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing   import LabelEncoder, StandardScaler
from sklearn.metrics         import (
    r2_score, mean_absolute_error,
    accuracy_score, f1_score
)
import warnings
warnings.filterwarnings("ignore")

# ── 70/30 SPLIT ──────────────────────────────────
TRAIN_SIZE   = 0.70
TEST_SIZE    = 0.30
RANDOM_STATE = 42


# ── Model registry ───────────────────────────────
def get_regression_models():
    from sklearn.linear_model import LinearRegression, Ridge
    from sklearn.ensemble     import (
        RandomForestRegressor,
        GradientBoostingRegressor
    )
    models = [
        ("Linear Regression",
            LinearRegression()),
        ("Ridge",
            Ridge(alpha=1.0)),
        ("Random Forest",
            RandomForestRegressor(
                n_estimators=100,
                random_state=RANDOM_STATE
            )),
        ("Gradient Boosting",
            GradientBoostingRegressor(
                n_estimators=100,
                random_state=RANDOM_STATE
            )),
    ]
    try:
        import importlib
        xgb = importlib.import_module("xgboost")
        models.append((
            "XGBoost",
            xgb.XGBRegressor(
                n_estimators=100,
                random_state=RANDOM_STATE,
                verbosity=0
            )
        ))
    except ImportError:
        pass
    return models


def get_classification_models():
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble     import (
        RandomForestClassifier,
        GradientBoostingClassifier
    )
    models = [
        ("Logistic Regression",
            LogisticRegression(
                max_iter=1000,
                random_state=RANDOM_STATE
            )),
        ("Random Forest",
            RandomForestClassifier(
                n_estimators=100,
                random_state=RANDOM_STATE
            )),
        ("Gradient Boosting",
            GradientBoostingClassifier(
                n_estimators=100,
                random_state=RANDOM_STATE
            )),
    ]
    try:
        from xgboost import XGBClassifier
        models.append((
            "XGBoost",
            XGBClassifier(
                n_estimators=100,
                random_state=RANDOM_STATE,
                verbosity=0,
                use_label_encoder=False,
                eval_metric="logloss"
            )
        ))
    except ImportError:
        pass
    return models


def get_clustering_models():
    from sklearn.cluster import KMeans, AgglomerativeClustering
    return [
        ("KMeans 3 clusters",
            KMeans(n_clusters=3,
                   random_state=RANDOM_STATE, n_init=10)),
        ("KMeans 5 clusters",
            KMeans(n_clusters=5,
                   random_state=RANDOM_STATE, n_init=10)),
        ("Agglomerative 3 clusters",
            AgglomerativeClustering(n_clusters=3)),
    ]


# ── Dataset analyzer ─────────────────────────────
def analyze_dataset(df: pd.DataFrame) -> dict:
    info = {
        "rows"         : len(df),
        "columns"      : list(df.columns),
        "dtypes"       : {c: str(df[c].dtype) for c in df.columns},
        "missing_pct"  : round(
            df.isna().sum().sum() /
            (len(df) * len(df.columns)) * 100, 2
        ),
        "numeric_cols" : list(
            df.select_dtypes(include=[np.number]).columns
        ),
        "text_cols"    : list(
            df.select_dtypes(include=["object"]).columns
        ),
        "sample"       : df.head(3).to_dict(orient="records"),
        "unique_counts": {c: int(df[c].nunique()) for c in df.columns},
        "train_test_split": f"{int(TRAIN_SIZE*100)}/{int(TEST_SIZE*100)}"
    }

    targets = []
    for col in df.columns:
        c = col.lower()
        if any(w in c for w in [
            "target","label","class","sale","revenue",
            "price","amount","predict","outcome",
            "result","churn","fraud","status","score"
        ]):
            targets.append(col)
    info["potential_targets"] = targets
    return info


# ── Ollama ML advisor ─────────────────────────────
def ask_ollama_for_recommendation(info: dict) -> dict:
    from backend.llm_client import get_sql_from_llm

    prompt = f"""You are an expert ML engineer.
Analyze this dataset and recommend the best ML approach.
Return ONLY valid JSON. No markdown. No explanation.

Dataset info:
- Rows: {info['rows']}
- Columns: {info['columns']}
- Numeric columns: {info['numeric_cols']}
- Text columns: {info['text_cols']}
- Missing %: {info['missing_pct']}
- Unique counts: {info['unique_counts']}
- Potential targets: {info['potential_targets']}
- Sample: {json.dumps(info['sample'], default=str)[:400]}
- Train/Test split: {info['train_test_split']}

Rules:
- numeric target → regression
- 2-10 unique text/int values as target → classification
- no clear target → clustering
- supervised if target exists

Return exactly this JSON:
{{
  "problem_type": "supervised or unsupervised",
  "task": "regression or classification or clustering",
  "target_column": "column_name or null",
  "feature_columns": ["col1", "col2", "col3"],
  "recommended_model": "model name",
  "reason": "one sentence",
  "alternative_models": ["model2", "model3"],
  "expected_accuracy": "XX-XX%",
  "preprocessing": ["normalize", "encode_categories"]
}}

JSON:"""

    try:
        raw = get_sql_from_llm(prompt).strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw   = raw.strip()
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
        return json.loads(raw)

    except Exception as e:
        print(f"Ollama error: {e}")
        numeric = info.get("numeric_cols", [])
        targets = info.get("potential_targets", [])
        target  = targets[0] if targets else (
            numeric[-1] if numeric else None
        )
        features = [c for c in numeric if c != target][:5]
        task = "regression"
        if target and info.get("unique_counts", {}).get(target, 99) <= 10:
            task = "classification"
        return {
            "problem_type"      : "supervised" if target else "unsupervised",
            "task"              : task if target else "clustering",
            "target_column"     : target,
            "feature_columns"   : features,
            "recommended_model" : "Random Forest",
            "reason"            : "Auto-selected based on data structure",
            "alternative_models": ["Gradient Boosting", "XGBoost"],
            "expected_accuracy" : "75-90%",
            "preprocessing"     : ["normalize", "encode_categories"]
        }


# ── Data preprocessor ─────────────────────────────
def preprocess(
    df        : pd.DataFrame,
    feat_cols : list,
    target_col: str = None,
    task      : str = "regression"
) -> tuple:
    df = df.copy()

    if target_col and target_col in df.columns:
        df = df.dropna(subset=[target_col])

    keep = [c for c in feat_cols if c in df.columns]
    if target_col and target_col in df.columns:
        keep.append(target_col)
    df = df[keep].copy()

    encoders = {}
    for col in df.select_dtypes(include=["object"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    for col in df.columns:
        if df[col].isnull().sum() > 0:
            if df[col].dtype in ["int64","float64"]:
                df[col].fillna(df[col].median(), inplace=True)
            else:
                df[col].fillna(0, inplace=True)

    return df, encoders


# ── Feature importance ────────────────────────────
def get_feature_importance(model, feature_names: list) -> list:
    try:
        if hasattr(model, "feature_importances_"):
            imps  = model.feature_importances_
            total = sum(imps)
            return sorted([
                {
                    "feature"   : f,
                    "importance": round(float(i), 4),
                    "pct"       : round(float(i/total*100), 1)
                }
                for f, i in zip(feature_names, imps)
            ], key=lambda x: x["importance"], reverse=True)

        elif hasattr(model, "coef_"):
            coefs = np.abs(model.coef_.flatten())
            total = sum(coefs)
            if total == 0:
                return []
            return sorted([
                {
                    "feature"   : f,
                    "importance": round(float(c), 4),
                    "pct"       : round(float(c/total*100), 1)
                }
                for f, c in zip(feature_names, coefs)
            ], key=lambda x: x["importance"], reverse=True)
    except Exception:
        pass
    return []


# ── Main AutoML runner ────────────────────────────
def run_automl(
    df             : pd.DataFrame,
    recommendation : dict,
    target_accuracy: float = 0.85
) -> dict:

    task       = recommendation.get("task", "regression")
    target_col = recommendation.get("target_column")
    feat_cols  = recommendation.get("feature_columns", [])

    # validate feature columns
    feat_cols = [c for c in feat_cols if c in df.columns]
    if not feat_cols:
        numeric   = df.select_dtypes(
            include=[np.number]
        ).columns.tolist()
        feat_cols = [c for c in numeric if c != target_col][:5]

    if not feat_cols:
        return {"error": "No valid feature columns found"}

    results = {
        "task"              : task,
        "target_column"     : target_col,
        "feature_columns"   : feat_cols,
        "train_size"        : f"{int(TRAIN_SIZE*100)}%",
        "test_size"         : f"{int(TEST_SIZE*100)}%",
        "models_tried"      : [],
        "best_model"        : None,
        "best_accuracy"     : 0,
        "best_accuracy_pct" : "0%",
        "best_score"        : {},
        "feature_importance": [],
        "predictions"       : [],
        "actual_vs_pred"    : [],
        "reached_target"    : False
    }

    # ── CLUSTERING ───────────────────────────────
    if task == "clustering":
        df_clean, _ = preprocess(df, feat_cols)
        X        = df_clean[feat_cols].values
        scaler   = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        for name, model in get_clustering_models():
            try:
                labels     = model.fit_predict(X_scaled)
                n_clusters = len(set(labels)) - (
                    1 if -1 in labels else 0
                )
                from sklearn.metrics import silhouette_score
                score = silhouette_score(
                    X_scaled, labels
                ) if n_clusters > 1 else 0.0

                results["models_tried"].append({
                    "name"      : name,
                    "score"     : round(float(score), 4),
                    "score_pct" : f"{round(score*100, 1)}%",
                    "metric"    : "Silhouette Score",
                    "n_clusters": n_clusters,
                    "status"    : "✅" if score >= 0.5 else "⬜"
                })

                if score > results["best_accuracy"]:
                    results["best_accuracy"]     = score
                    results["best_accuracy_pct"] = f"{round(score*100,1)}%"
                    results["best_model"]        = name
                    results["best_score"]        = {
                        "silhouette_score": round(float(score), 4),
                        "n_clusters"      : n_clusters
                    }
                    sample = df.head(30).copy()
                    sample["cluster"] = labels[:30]
                    results["predictions"] = \
                        sample.to_dict(orient="records")

            except Exception as e:
                results["models_tried"].append({
                    "name": name, "error": str(e), "status": "❌"
                })

        results["reached_target"] = results["best_accuracy"] >= 0.5
        return results

    # ── SUPERVISED ───────────────────────────────
    if not target_col or target_col not in df.columns:
        return {
            "error": f"Target column '{target_col}' not found. "
                     f"Available: {list(df.columns)}"
        }

    df_clean, encoders = preprocess(
        df, feat_cols, target_col, task
    )

    X = df_clean[feat_cols].values
    y = df_clean[target_col].values

    if len(X) < 10:
        return {"error": "Need at least 10 rows for ML training"}

    # 70/30 split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size    = TEST_SIZE,
        random_state = RANDOM_STATE
    )

    results["train_rows"] = len(X_train)
    results["test_rows"]  = len(X_test)

    # scale
    scaler  = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    models = (
        get_regression_models()
        if task == "regression"
        else get_classification_models()
    )

    for name, model in models:
        try:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            if task == "regression":
                score = max(0.0, float(r2_score(y_test, y_pred)))
                mae   = float(mean_absolute_error(y_test, y_pred))
                score_info = {
                    "r2_score": round(score, 4),
                    "mae"     : round(mae, 2),
                    "accuracy": f"{round(score*100, 1)}%"
                }
                metric_name = "R² Score"
            else:
                score = float(accuracy_score(y_test, y_pred))
                f1    = float(f1_score(
                    y_test, y_pred, average="weighted"
                ))
                score_info = {
                    "accuracy": f"{round(score*100, 1)}%",
                    "f1_score": round(f1, 4)
                }
                metric_name = "Accuracy"

            status = "✅" if score >= target_accuracy else "⬜"

            results["models_tried"].append({
                "name"      : name,
                "score"     : round(score, 4),
                "score_pct" : f"{round(score*100, 1)}%",
                "metric"    : metric_name,
                "details"   : score_info,
                "status"    : status
            })

            print(f"  {name}: {round(score*100,1)}% {status}")

            if score > results["best_accuracy"]:
                results["best_accuracy"]      = score
                results["best_accuracy_pct"]  = f"{round(score*100,1)}%"
                results["best_model"]         = name
                results["best_score"]         = score_info
                results["feature_importance"] = get_feature_importance(
                    model, feat_cols
                )
                results["actual_vs_pred"] = [
                    {
                        "index"    : i,
                        "actual"   : round(float(y_test[i]), 2),
                        "predicted": round(float(y_pred[i]), 2),
                        "error"    : round(
                            abs(float(y_test[i]) -
                                float(y_pred[i])), 2
                        )
                    }
                    for i in range(min(30, len(y_test)))
                ]

            if score >= target_accuracy:
                results["reached_target"] = True
                print(f"  ✅ Target reached with {name}!")
                break

        except Exception as e:
            results["models_tried"].append({
                "name": name, "error": str(e), "status": "❌"
            })

    return results