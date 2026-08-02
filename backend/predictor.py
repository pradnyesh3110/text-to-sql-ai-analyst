# backend/predictor.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def detect_time_series(df: pd.DataFrame) -> dict:
    """Auto-detect date and value columns"""
    date_col  = None
    value_col = None

    # find date column by name
    for col in df.columns:
        c = col.lower()
        if any(w in c for w in [
            "date","time","month","year","day","period"
        ]):
            try:
                pd.to_datetime(df[col])
                date_col = col
                break
            except Exception:
                pass

    # try parsing any column as date
    if not date_col:
        for col in df.columns:
            try:
                parsed = pd.to_datetime(df[col])
                if parsed.nunique() > 3:
                    date_col = col
                    break
            except Exception:
                pass

    # find numeric value column
    num_cols = df.select_dtypes(
        include=[np.number]
    ).columns.tolist()

    for col in num_cols:
        c = col.lower()
        if any(w in c for w in [
            "sale","revenue","amount","price","cost",
            "profit","total","qty","quantity","count",
            "value","income"
        ]):
            value_col = col
            break

    if not value_col and num_cols:
        value_col = num_cols[0]

    return {
        "date_col" : date_col,
        "value_col": value_col,
        "detected" : date_col is not None
                     and value_col is not None
    }


def run_forecast(
    df        : pd.DataFrame,
    date_col  : str,
    value_col : str,
    periods   : int = 30
) -> dict:
    """Run time series forecast — tries Prophet first,
       falls back to linear regression"""
    try:
        from prophet import Prophet
        return _prophet_forecast(
            df, date_col, value_col, periods
        )
    except ImportError:
        return _linear_forecast(
            df, date_col, value_col, periods
        )
    except Exception as e:
        # Prophet failed for another reason — try linear
        print(f"Prophet error: {e} — using linear fallback")
        return _linear_forecast(
            df, date_col, value_col, periods
        )


def _prophet_forecast(df, date_col, value_col, periods):
    from prophet import Prophet

    prophet_df = pd.DataFrame({
        "ds": pd.to_datetime(df[date_col]),
        "y" : pd.to_numeric(
            df[value_col], errors="coerce"
        )
    }).dropna()

    prophet_df = prophet_df.sort_values("ds")
    prophet_df = (
        prophet_df.groupby("ds")["y"]
        .sum()
        .reset_index()
    )

    if len(prophet_df) < 2:
        return {
            "error": "Need at least 2 data points"
        }

    model = Prophet(
        yearly_seasonality = True,
        weekly_seasonality = False,
        daily_seasonality  = False,
        interval_width     = 0.80
    )
    model.fit(prophet_df)

    future   = model.make_future_dataframe(
        periods=periods
    )
    forecast = model.predict(future)

    last_date = prophet_df["ds"].max()

    actual = [
        {
            "date" : row["ds"].strftime("%Y-%m-%d"),
            "value": round(float(row["y"]), 2)
        }
        for _, row in prophet_df.iterrows()
    ]

    predicted = [
        {
            "date" : row["ds"].strftime("%Y-%m-%d"),
            "value": round(float(row["yhat"]), 2),
            "lower": round(float(row["yhat_lower"]), 2),
            "upper": round(float(row["yhat_upper"]), 2)
        }
        for _, row in forecast.iterrows()
        if row["ds"] > last_date
    ]

    return _build_result(
        actual, predicted, prophet_df,
        forecast, date_col, value_col,
        periods, "Prophet"
    )


def _linear_forecast(df, date_col, value_col, periods):
    from sklearn.linear_model import LinearRegression

    prophet_df = pd.DataFrame({
        "ds": pd.to_datetime(df[date_col]),
        "y" : pd.to_numeric(
            df[value_col], errors="coerce"
        )
    }).dropna().sort_values("ds")

    prophet_df = (
        prophet_df.groupby("ds")["y"]
        .sum()
        .reset_index()
    )

    base = prophet_df["ds"].min()
    prophet_df["x"] = (
        prophet_df["ds"] - base
    ).dt.days

    X = prophet_df[["x"]].values
    y = prophet_df["y"].values

    model = LinearRegression()
    model.fit(X, y)

    last_day     = prophet_df["x"].max()
    future_days  = [last_day + i + 1 for i in range(periods)]
    future_dates = [
        base + timedelta(days=int(d))
        for d in future_days
    ]
    preds = model.predict([[d] for d in future_days])

    actual = [
        {
            "date" : row["ds"].strftime("%Y-%m-%d"),
            "value": round(float(row["y"]), 2)
        }
        for _, row in prophet_df.iterrows()
    ]

    predicted = [
        {
            "date" : d.strftime("%Y-%m-%d"),
            "value": round(float(v), 2),
            "lower": round(float(v) * 0.9, 2),
            "upper": round(float(v) * 1.1, 2)
        }
        for d, v in zip(future_dates, preds)
    ]

    last_val  = float(y[-1])
    next_val  = float(preds[-1])
    trend_pct = round(
        (next_val - last_val) / last_val * 100, 1
    ) if last_val != 0 else 0

    return {
        "success"  : True,
        "method"   : "Linear Regression (fallback)",
        "date_col" : date_col,
        "value_col": value_col,
        "actual"   : actual,
        "predicted": predicted,
        "stats"    : {
            "mean"         : round(float(np.mean(y)), 2),
            "max"          : round(float(np.max(y)), 2),
            "min"          : round(float(np.min(y)), 2),
            "latest"       : round(last_val, 2),
            "forecast_next": round(next_val, 2),
            "trend_pct"    : trend_pct,
            "trend_dir"    : (
                "upward 📈"   if trend_pct > 5  else
                "downward 📉" if trend_pct < -5 else
                "stable ➡️"
            ),
            "data_points"  : len(actual),
            "forecast_days": periods
        }
    }


def _build_result(
    actual, predicted,
    prophet_df, forecast,
    date_col, value_col,
    periods, method
):
    y         = prophet_df["y"].values
    last_val  = float(y[-1])
    next_val  = float(forecast["yhat"].iloc[-1])
    trend_pct = round(
        (next_val - last_val) / last_val * 100, 1
    ) if last_val != 0 else 0

    return {
        "success"  : True,
        "method"   : method,
        "date_col" : date_col,
        "value_col": value_col,
        "actual"   : actual,
        "predicted": predicted,
        "stats"    : {
            "mean"         : round(float(np.mean(y)), 2),
            "max"          : round(float(np.max(y)), 2),
            "min"          : round(float(np.min(y)), 2),
            "latest"       : round(last_val, 2),
            "forecast_next": round(next_val, 2),
            "trend_pct"    : trend_pct,
            "trend_dir"    : (
                "upward 📈"   if trend_pct > 5  else
                "downward 📉" if trend_pct < -5 else
                "stable ➡️"
            ),
            "data_points"  : len(actual),
            "forecast_days": periods
        }
    }