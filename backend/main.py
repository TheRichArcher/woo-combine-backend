from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.players import router as players_router
from backend.routes.drills import router as drills_router
from backend.routes.events import router as events_router
from backend.routes.leagues import router as leagues_router
import logging
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://woo-combine.com",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players_router)
app.include_router(drills_router)
app.include_router(events_router)
app.include_router(leagues_router)

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

@app.get("/health")
def health_check():
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "details": str(e)}

@app.get("/cors-test")
def cors_test(request: Request):
    return {
        "message": "CORS test endpoint",
        "headers": dict(request.headers)
    }

@app.on_event("startup")
async def startup_event():
    logging.basicConfig(level=logging.INFO)
    logging.info("🚀 Backend startup complete.")

# TEMPORARY: Add league_id column if missing
engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS league_id VARCHAR;"))

# from routes import players, drills, auth  # To be registered later 