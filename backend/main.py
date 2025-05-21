from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.players import router as players_router
from backend.routes.drills import router as drills_router
from backend.routes.events import router as events_router
import logging
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players_router)
app.include_router(drills_router)
app.include_router(events_router)

# Path to the folder that contains index.html (adjust if different)
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"

# Serve /assets/* etc. if Vite didn't already mount them
app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """
    1) If the requested path is an actual file in dist/, serve it directly
       (e.g. /logo.png, /assets/index-xyz.js).
    2) Otherwise return index.html so React Router handles the route.
    """
    candidate = DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)

    # default → /index.html
    return FileResponse(DIST_DIR / "index.html")

@app.get("/health")
def health_check():
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "details": str(e)}

@app.on_event("startup")
async def startup_event():
    logging.basicConfig(level=logging.INFO)
    logging.info("🚀 Backend startup complete.")

# from routes import players, drills, auth  # To be registered later 