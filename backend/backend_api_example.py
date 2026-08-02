# Add this to your Flask/FastAPI backend main file
# Example for Flask:

from flask import Flask, request, jsonify
from backend.automl import run_automl, predict_future_trend, analyze_dataset, ask_ollama_for_recommendation
import pandas as pd

app = Flask(__name__)

@app.route("/automl", methods=["POST"])
def automl():
    data = request.json
    df = pd.DataFrame(data["dataframe"])
    rec = data.get("recommendation") or ask_ollama_for_recommendation(analyze_dataset(df))
    result = run_automl(df, rec, target_accuracy=data.get("target_accuracy", 0.85))
    return jsonify(result)

@app.route("/predict-trend", methods=["POST"])
def predict_trend():
    """Forecast future values using the last trained model."""
    data = request.json
    df = pd.DataFrame(data["dataframe"])
    periods = data.get("periods", 5)
    result = predict_future_trend(df, periods=periods)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5000)