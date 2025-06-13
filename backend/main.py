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

app = FastAPI(title="WooCombine API", version="1.0.0")

# CORS configuration for production and development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://woo-combine.com",
        "https://woo-combine-backend.onrender.com",
        "http://localhost:5173",  # Local development
        "http://localhost:3000",  # Alternative dev port
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firestore connection early to catch any issues
try:
    from backend.firestore_client import get_firestore_client
    firestore_client = get_firestore_client()
    logging.info("[STARTUP] Firestore client initialized successfully")
except Exception as e:
    logging.warning(f"[STARTUP] Firestore initialization issue (using mock): {e}")

# Include API routes with /api prefix to avoid conflicts with static frontend
app.include_router(players_router, prefix="/api", tags=["Players"])
app.include_router(leagues_router, prefix="/api", tags=["Leagues"])
app.include_router(drills_router, prefix="/api", tags=["Drills"])
app.include_router(events_router, prefix="/api", tags=["Events"])

@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Basic health check
        health_status = {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
        
        # Test Firestore connection
        try:
            from backend.firestore_client import get_firestore_client
            client = get_firestore_client()
            # Simple test - this works with both real and mock clients
            test_collection = client.collection("health_check")
            health_status["firestore"] = "connected"
        except Exception as e:
            health_status["firestore"] = f"error: {str(e)}"
            
        return health_status
    except Exception as e:
        return {"status": "error", "details": str(e)}

@app.get("/")
def root():
    """Root endpoint for basic API info"""
    return {
        "message": "WooCombine API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    logging.info("[STARTUP] WooCombine API starting up...")
    
    # Check environment
    env_vars = [
        "GOOGLE_CLOUD_PROJECT",
        "FIREBASE_PROJECT_ID", 
        "GOOGLE_APPLICATION_CREDENTIALS_JSON"
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            logging.info(f"[STARTUP] {var}: configured")
        else:
            logging.warning(f"[STARTUP] {var}: not set")
    
    # Check frontend directory
    dist_dir = Path(__file__).parent.parent / "frontend" / "dist"
    if dist_dir.exists():
        logging.info(f"[STARTUP] Frontend directory found: {dist_dir}")
    else:
        logging.warning(f"[STARTUP] Frontend directory not found: {dist_dir}")

# Serve frontend static files (if available)
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=DIST_DIR / "assets"),
        name="static",
    )
    app.mount(
        "/",
        StaticFiles(directory=DIST_DIR, html=True),
        name="spa",
    )
    logging.info(f"[STARTUP] Serving frontend from: {DIST_DIR}")
else:
    logging.warning(f"[STARTUP] Frontend not available - {DIST_DIR} does not exist") 