from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from .routes.players import router as players_router
from .routes.leagues import router as leagues_router
from .routes.drills import router as drills_router
from .routes.events import router as events_router
from .routes.users import router as users_router
from .routes.evaluators import router as evaluators_router
from .routes.batch import router as batch_router
from .auth import get_current_user
from .middleware.rate_limiting import add_rate_limiting, health_rate_limit
from .middleware.security import add_security_middleware
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

# Add security middleware (first for maximum protection)
add_security_middleware(app)

# Add rate limiting middleware
add_rate_limiting(app)

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
    allow_origins=["*"],  # Temporarily allow all origins to fix immediate issue
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Lazy Firestore initialization to speed up startup
_firestore_client = None

def get_firestore_lazy():
    global _firestore_client
    if _firestore_client is None:
        try:
            from .firestore_client import get_firestore_client
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
app.include_router(users_router, prefix="/api", tags=["Users"])
app.include_router(evaluators_router, prefix="/api", tags=["Evaluators"])
app.include_router(batch_router, prefix="/api", tags=["Batch Operations"])

# Health check endpoint for debugging
@app.get("/api/health")
@health_rate_limit()
def health_check(request: Request):
    """Simple health check that tests key system components"""
    try:
        # Test Firestore connection
        firestore_client = get_firestore_lazy()
        if firestore_client:
            # Test a simple read operation
            test_doc = firestore_client.collection("_health").document("test").get()
            firestore_status = "connected"
        else:
            firestore_status = "unavailable"
    except Exception as e:
        firestore_status = f"error: {str(e)}"
    
    return {
        "status": "running",
        "firestore": firestore_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.2"
    }

@app.get("/health")
@app.head("/health")
@health_rate_limit()
def simple_health(request: Request):
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

# Simple test endpoint to debug 500 errors
@app.post("/api/test-500")
def test_500_debug():
    """Test endpoint to see if 500 errors are systemic"""
    try:
        logging.info("[TEST] Test endpoint called successfully")
        return {"status": "success", "message": "POST endpoint working"}
    except Exception as e:
        logging.error(f"[TEST] Error in test endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@app.post("/api/test-auth")
def test_auth_debug(current_user=Depends(get_current_user)):
    """Test endpoint to see if auth is causing 500 errors"""
    try:
        logging.info(f"[TEST-AUTH] Auth test called by user: {current_user.get('uid', 'unknown')}")
        return {"status": "success", "user": current_user.get('uid', 'unknown'), "message": "Auth working"}
    except Exception as e:
        logging.error(f"[TEST-AUTH] Error in auth test: {e}")
        raise HTTPException(status_code=500, detail=f"Auth test failed: {str(e)}")

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