# app.py - root level entry point for Render
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)