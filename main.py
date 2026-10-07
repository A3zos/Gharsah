import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.db import fetch_one
from app.routers import chat, recite, tts, data, agent

app = FastAPI(title="Manara AI Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

app.include_router(chat.router)
app.include_router(recite.router)
app.include_router(tts.router)
app.include_router(data.router)
app.include_router(agent.router)


@app.get("/health")
def health():
    db_ok = False
    try:
        row = fetch_one("SELECT 1 AS ok")
        db_ok = bool(row and row["ok"] == 1)
    except Exception as e:
        return {"status": "error", "db": False, "detail": str(e)}
    return {"status": "ok", "db": db_ok}


# The Manara web app (static/index.html) is served from the site root.
# Mounted last so every API route above takes precedence.
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
