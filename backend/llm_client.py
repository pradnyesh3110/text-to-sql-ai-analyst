# backend/llm_client.py
import os
import requests
import re
from groq import Groq

# ─── Config ───────────────────────────────────────────
OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"
GROQ_MODEL   = "llama3-8b-8192"

# Detect if we're in cloud demo mode
IS_DEMO = os.environ.get("DEMO_MODE", "false").lower() == "true"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ─── Groq Client (only created if needed) ─────────────
_groq_client = None
if IS_DEMO and GROQ_API_KEY:
    _groq_client = Groq(api_key=GROQ_API_KEY)

# ─── Main Function ────────────────────────────────────
def get_sql_from_llm(prompt: str) -> str:
    if IS_DEMO and _groq_client:
        return _get_sql_from_groq(prompt)
    else:
        return _get_sql_from_ollama(prompt)

# ─── Cloud: Groq ──────────────────────────────────────
def _get_sql_from_groq(prompt: str) -> str:
    try:
        response = _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a SQL expert. Return ONLY the SQL query, no explanation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1024
        )
        sql = response.choices[0].message.content.strip()
        return _clean_sql(sql)
    except Exception as e:
        print(f"Groq error: {e}")
        return ""

# ─── Local: Ollama ────────────────────────────────────
def _get_sql_from_ollama(prompt: str) -> str:
    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=120
        )
        sql = response.json()["response"].strip()
        return _clean_sql(sql)
    except Exception as e:
        print(f"Ollama error: {e}")
        return ""

# ─── Clean markdown ───────────────────────────────────
def _clean_sql(sql: str) -> str:
    sql = re.sub(r"```sql", "", sql)
    sql = re.sub(r"```", "", sql)
    return sql.strip()

# ─── Warmup (Ollama only) ─────────────────────────────
if not IS_DEMO:
    import threading
    def _warmup():
        try:
            requests.post(OLLAMA_URL, json={
                "model": OLLAMA_MODEL, "prompt": "hi", "stream": False
            }, timeout=30)
            print("✅ Ollama warmed up")
        except:
            pass
    threading.Thread(target=_warmup, daemon=True).start()