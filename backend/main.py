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
from starlette.responses import Response, JSONResponse
from google.cloud import firestore
from datetime import datetime
import asyncio

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="WooCombine API", version="1.0.2")

# Fast OPTIONS response middleware to handle CORS preflight quickly
class FastOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle OPTIONS requests immediately without processing
        if request.method == "OPTIONS":
            logging.info(f"[FAST-OPTIONS] Handling OPTIONS request for {request.url.path}")
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Max-Age": "86400",  # Cache preflight for 24 hours
                }
            )
        
        response = await call_next(request)
        return response

# Add fast OPTIONS middleware first
app.add_middleware(FastOptionsMiddleware)

# CORS configuration for production and development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://woo-combine.com",
        "https://woo-combine-backend.onrender.com",
        "http://localhost:5173",  # Local development
        "http://localhost:5174",  # Alternative dev port 
        "http://localhost:5175",  # Alternative dev port 
        "http://localhost:3000",  # Alternative dev port
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy Firestore initialization to speed up startup
_firestore_client = None

def get_firestore_lazy():
    global _firestore_client
    if _firestore_client is None:
        try:
            from backend.firestore_client import get_firestore_client
            _firestore_client = get_firestore_client()
            logging.info("[STARTUP] Firestore client initialized lazily")
        except Exception as e:
            logging.warning(f"[STARTUP] Firestore lazy initialization issue: {e}")
            _firestore_client = None
    return _firestore_client

# Include API routes with /api prefix to avoid conflicts with static frontend
app.include_router(players_router, prefix="/api", tags=["Players"])
app.include_router(leagues_router, prefix="/api", tags=["Leagues"])
app.include_router(drills_router, prefix="/api", tags=["Drills"])
app.include_router(events_router, prefix="/api", tags=["Events"])

@app.get("/health")
@app.head("/health")
def health_check():
    """Minimal health check endpoint for deployment monitoring"""
    return {
        "status": "ok", 
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.2",
        "cors_debug": "woo-combine.com should be allowed"
    }

@app.get("/api")
def root():
    """Root endpoint for basic API info"""
    return {
        "message": "WooCombine API",
        "version": "1.0.2",
        "status": "running",
        "docs": "/docs"
    }

# Startup event - minimal operations for fast startup
@app.on_event("startup")
async def startup_event():
    logging.info("[STARTUP] WooCombine API starting up...")
    
    # Don't initialize Firestore on startup - do it lazily
    logging.info("[STARTUP] Using lazy Firestore initialization for faster cold starts")
    
    # Just log environment status quickly
    critical_vars = ["GOOGLE_CLOUD_PROJECT", "FIREBASE_PROJECT_ID"]
    for var in critical_vars:
        if os.getenv(var):
            logging.info(f"[STARTUP] {var}: ✓ configured")
        else:
            logging.warning(f"[STARTUP] {var}: ✗ not set")

# TEMPORARILY DISABLE FRONTEND SERVING TO ISOLATE API ISSUES
# Frontend will be served separately from woo-combine.com
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    logging.info(f"[STARTUP] Frontend directory found but NOT serving (API-only mode): {DIST_DIR}")
else:
    logging.warning(f"[STARTUP] Frontend not available - {DIST_DIR} does not exist")

# Simple root route for testing - explicitly handle GET and HEAD for Render health checks
@app.get("/")
@app.head("/")
async def serve_api_info(request: Request):
    logging.info(f"[ROOT] {request.method} request to / from {request.client}")
    return {
        "message": "WooCombine API (Optimized for cold starts)",
        "status": "running", 
        "frontend": "served separately",
        "api_prefix": "/api"
    } 