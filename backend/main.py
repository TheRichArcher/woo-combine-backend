from fastapi import FastAPI, Request, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from .routes.players import router as players_router
from .routes.leagues import router as leagues_router
from .routes.drills import router as drills_router
from .routes.events import router as events_router
from .routes.users import router as users_router
from .routes.evaluators import router as evaluators_router
from .routes.batch import router as batch_router
from .routes.imports import router as imports_router
from .routes.stats import router as stats_router
from .routes.schemas import router as schemas_router
from .routes.migrations import router as migrations_router
from .routes.drafts import router as drafts_router
from .auth import get_current_user
from .middleware.rate_limiting import add_rate_limiting, health_rate_limit
from .middleware.abuse_protection import add_abuse_protection_middleware
from .middleware.security import (
    add_security_headers_middleware,
    add_request_validation_middleware,
)
from .middleware.observability import (
    ObservabilityMiddleware,
    init_sentry_if_configured,
)
import logging
from pathlib import Path
import os
from starlette.responses import Response, JSONResponse
from fastapi.responses import PlainTextResponse
from datetime import datetime
from .utils.error_handling import StandardError, handle_standard_error
from . import __version__
 
# Enable or disable debug/test endpoints via environment
_ENABLE_DEBUG_ENDPOINTS = os.getenv("ENABLE_DEBUG_ENDPOINTS", "false").lower() in ("1", "true", "yes")

def _get_log_level_from_env() -> int:
    level_str = os.getenv("LOG_LEVEL", "INFO").upper().strip()
    mapping = {
        "CRITICAL": logging.CRITICAL,
        "ERROR": logging.ERROR,
        "WARNING": logging.WARNING,
        "WARN": logging.WARNING,
        "INFO": logging.INFO,
        "DEBUG": logging.DEBUG,
        "NOTSET": logging.NOTSET,
    }
    return mapping.get(level_str, logging.INFO)

logging.basicConfig(level=_get_log_level_from_env())

app = FastAPI(title="WooCombine API", version=__version__)
init_sentry_if_configured()
app.add_middleware(ObservabilityMiddleware)

# Middleware order (outermost last-added): security headers → abuse protection → rate limiting → request validation → CORS → routing
# 1) Security headers
add_security_headers_middleware(app)

# Global handler for application-standard errors
@app.exception_handler(StandardError)
async def standard_error_handler(request: Request, exc: StandardError):
    he = handle_standard_error(exc)
    return JSONResponse(status_code=he.status_code, content={"detail": he.detail})

# CORS configuration
# Parse and normalize ALLOWED_ORIGINS from env, trimming whitespace and dropping empties
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()] if _allowed_origins_env else []
allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX")
if not allowed_origins:
    # Safe defaults for local/dev
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    # Also allow production domain by default via regex if env not provided
    if not allowed_origin_regex:
        allowed_origin_regex = r"^https://(www\.)?woo-combine\.com$"

logging.info(f"[CORS] allowed_origins={allowed_origins}")
if allowed_origin_regex:
    logging.info(f"[CORS] allowed_origin_regex={allowed_origin_regex}")

# 3) Abuse protection for auth flows
add_abuse_protection_middleware(app)

# 4) Rate limiting (must come before request validation so 413s do not bypass limits)
add_rate_limiting(app)

# 5) Request validation (after rate limiting)
add_request_validation_middleware(app, config={"max_request_size": 5 * 1024 * 1024})

# 6) CORS (must be outermost so it can short-circuit OPTIONS and attach headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Enumerate common headers used by the app
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Requested-With",
        "X-Abuse-Nonce",
        "X-Abuse-Answer",
        "X-Delete-Target-Event-Id",     # Required for event deletion validation
        "X-Delete-Intent-Token",        # Optional token for one-time-use validation
    ],
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
            if "DefaultCredentialsError" in str(e) or "credentials" in str(e).lower():
                logging.error("[STARTUP] ❗ Missing Firebase credentials! Set GOOGLE_APPLICATION_CREDENTIALS_JSON in environment")
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
app.include_router(imports_router, prefix="/api", tags=["Imports"])
app.include_router(stats_router, prefix="/api", tags=["Stats"])
app.include_router(drafts_router, prefix="/api", tags=["Drafts"])
app.include_router(schemas_router, prefix="/api", tags=["Schemas"])
app.include_router(migrations_router, prefix="/api", tags=["Migrations"])

# Simple config/meta endpoint to help frontend adapt and for debugging
@app.get("/api/meta")
def meta():
    return {
        "version": __version__,
        "allowed_origins": os.getenv("ALLOWED_ORIGINS", ""),
        "role_simple_enabled": os.getenv("ENABLE_ROLE_SIMPLE", "false").lower() in ("1", "true", "yes")
    }

# Security contact endpoints
@app.get("/security.txt", include_in_schema=False)
@app.get("/.well-known/security.txt", include_in_schema=False)
def security_txt():
    contact = os.getenv("SECURITY_CONTACT_EMAIL", "security@woo-combine.com")
    policy_url = os.getenv("SECURITY_POLICY_URL", "https://www.woo-combine.com/security")
    acknowledgments = os.getenv("SECURITY_ACK_URL", "https://www.woo-combine.com/hall-of-fame")
    content = f"""Contact: mailto:{contact}
Policy: {policy_url}
Acknowledgments: {acknowledgments}
Preferred-Languages: en
Canonical: https://www.woo-combine.com/.well-known/security.txt
"""
    return PlainTextResponse(content, media_type="text/plain; charset=utf-8")

# Health check endpoint for debugging
@app.get("/api/health")
@health_rate_limit()
def health_check(request: Request):
    """Public minimal health check (no sensitive details)."""
    firestore_status = "uninitialized"
    try:
        client = get_firestore_lazy()
        firestore_status = "connected" if client else "unavailable"
    except Exception:
        firestore_status = "error"
    return {
        "status": "ok",
        "firestore": firestore_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
@app.head("/health")
@health_rate_limit()
def simple_health(request: Request):
    """Minimal health check endpoint for deployment monitoring"""
    firestore_status = "uninitialized"
    try:
        client = get_firestore_lazy()
        firestore_status = "connected" if client else "unavailable"
    except Exception:
        firestore_status = "error"
    return {
        "status": "ok",
        "firestore": firestore_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/warmup")
@health_rate_limit()
def warmup_endpoint(request: Request):
    """Enhanced warmup endpoint with parallel operations for faster cold start recovery"""
    start_time = datetime.utcnow()
    
    # PERFORMANCE OPTIMIZATION: Parallel warmup operations for maximum efficiency
    import concurrent.futures
    
    def warmup_firestore():
        try:
            from .firestore_client import get_firestore_client
            db = get_firestore_client()

            # Execute collection warmups truly in parallel with bounded waits
            def fetch_one(col_name: str):
                try:
                    return db.collection(col_name).limit(1).get()
                except Exception as exc:
                    logging.warning(f"[WARMUP] Warmup fetch failed for {col_name}: {exc}")
                    return None

            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [
                    executor.submit(fetch_one, "users"),
                    executor.submit(fetch_one, "leagues"),
                    executor.submit(fetch_one, "user_memberships"),
                ]
                for f in futures:
                    try:
                        # Bound each warmup subtask to avoid stalling the endpoint
                        f.result(timeout=4)
                    except Exception as sub_exc:
                        logging.warning(f"[WARMUP] Subtask timed out or failed: {sub_exc}")

            return "warmed"
        except Exception as e:
            logging.error(f"[WARMUP] Firestore warmup failed: {e}")
            return f"failed: {str(e)[:50]}"
    
    def warmup_auth():
        try:
            from . import auth  # noqa: F401 - intentional preload
            from firebase_admin import auth as admin_auth  # noqa: F401 - intentional preload
            
            # Test that auth module is importable and Firebase Admin is initialized
            logging.info("[WARMUP] Auth module pre-initialized")
            return "warmed"
        except Exception as e:
            logging.error(f"[WARMUP] Auth warmup failed: {e}")
            return f"failed: {str(e)[:50]}"
    
    def warmup_routes():
        try:
            from .routes import leagues, users  # noqa: F401 - intentional preload
            logging.info("[WARMUP] Critical routes pre-initialized")
            return "warmed"
        except Exception as e:
            logging.error(f"[WARMUP] Routes warmup failed: {e}")
            return f"failed: {str(e)[:50]}"
    
    # Execute all warmup tasks in parallel for maximum speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future_firestore = executor.submit(warmup_firestore)
        future_auth = executor.submit(warmup_auth)
        future_routes = executor.submit(warmup_routes)
        
        # Collect results
        firestore_status = future_firestore.result()
        auth_status = future_auth.result()
        routes_status = future_routes.result()
    
    end_time = datetime.utcnow()
    duration_ms = (end_time - start_time).total_seconds() * 1000
    
    return {
        "status": "warmed",
        "duration_ms": round(duration_ms, 2),
        "firestore": firestore_status,
        "auth": auth_status,
        "routes": routes_status,
        "timestamp": end_time.isoformat(),
        "version": __version__
    }


@app.post("/api/csp-report", include_in_schema=False)
def csp_report(report: dict = Body(default=None)):
    """
    Minimal CSP report collector. Accepts application/csp-report or JSON.
    Logs payload and returns 204. Rate-limit at edge/WAF.
    """
    try:
        logging.warning(f"[CSP] Violation report: {report}")
    except Exception:
        logging.warning("[CSP] Violation report received (unparseable)")
    return Response(status_code=204)
@app.get("/api")
def root():
    """Root endpoint for basic API info"""
    return {
        "message": "WooCombine API",
        "version": __version__,
        "status": "running",
        "docs": "/docs"
    }

# Simple test endpoints (gated in production)
if _ENABLE_DEBUG_ENDPOINTS:
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
    
    # Validate delete token secret key (fail fast if misconfigured)
    from .utils.delete_token import validate_secret_key
    if validate_secret_key():
        logging.info("[STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured - Token-based deletion enabled")
    else:
        logging.error("[STARTUP] DELETE_TOKEN_SECRET_KEY: ✗ not set - Token-based deletion DISABLED")
        logging.error("[STARTUP] Set DELETE_TOKEN_SECRET_KEY environment variable to enable secure token system")
    
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