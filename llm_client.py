# backend/llm_client.py
import requests
import re

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"

def get_sql_from_llm(prompt: str) -> str:
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model"  : OLLAMA_MODEL,
                "prompt" : prompt,
                "stream" : False
            },
            timeout=120
        )

        result = response.json()
        sql    = result["response"].strip()

        # clean markdown
        sql = re.sub(r"```sql", "", sql)
        sql = re.sub(r"```",    "", sql)
        sql = sql.strip()

        return sql

    except Exception as e:
        print(f"Ollama error: {e}")
        return ""
# Keep model warm — call once on startup
import threading
def _warmup():
    try:
        requests.post(OLLAMA_URL, json={
            "model" : OLLAMA_MODEL,
            "prompt": "hi",
            "stream": False
        }, timeout=30)
        print("✅ Ollama model warmed up")
    except:
        pass

threading.Thread(target=_warmup, daemon=True).start()    