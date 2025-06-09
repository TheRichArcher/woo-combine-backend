from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.players import router as players_router
from backend.routes.leagues import router as leagues_router
from backend.routes.drills import router as drills_router
from backend.routes.events import router as events_router
import logging
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from google.cloud import firestore
from datetime import datetime

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://woo-combine.com",
        "http://localhost:5173",  # Allow local development
        "http://localhost:3000",  # Alternative dev port
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players_router, prefix="", tags=["Players"])
app.include_router(leagues_router, prefix="", tags=["Leagues"])
app.include_router(drills_router, prefix="", tags=["Drills"])
app.include_router(events_router, prefix="", tags=["Events"])

@app.get("/health")
def health_check():
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "details": str(e)}





# Path to the folder that contains index.html (adjust if different)
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=DIST_DIR, html=True),
        name="spa",
    )
else:
    logging.warning(f"WARNING: {DIST_DIR} does not exist. Frontend will not be served.") 