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
    ],
    allow_credentials=True,
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

@app.get("/cors-test")
def cors_test(request: Request):
    return {
        "message": "CORS test endpoint",
        "headers": dict(request.headers)
    }

@app.get("/test-firestore")
def test_firestore():
    try:
        db = firestore.Client()
        test_ref = db.collection("test").document("connectivity-check")
        test_ref.set({"status": "ok"})
        doc = test_ref.get()
        data = doc.to_dict() if doc.exists else None
        return {"success": True, "data": data}
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}

@app.get("/debug/system")
def debug_system():
    """System health and configuration check"""
    try:
        import sys
        import platform
        
        return {
            "python_version": sys.version,
            "platform": platform.platform(),
            "fastapi_running": True,
            "logging_level": logging.getLogger().level,
            "environment_vars": {
                "GOOGLE_APPLICATION_CREDENTIALS": bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")),
                "PORT": os.environ.get("PORT", "Not set")
            }
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

@app.get("/debug/firestore-ops")
def debug_firestore_operations():
    """Test various Firestore operations to isolate issues"""
    results = {}
    try:
        db = firestore.Client()
        
        # Test 1: Client creation
        results["client_creation"] = "SUCCESS"
        
        # Test 2: Collection reference
        test_collection = db.collection("debug_test")
        results["collection_reference"] = "SUCCESS"
        
        # Test 3: Document write
        doc_ref = test_collection.document("test_doc")
        doc_ref.set({"timestamp": datetime.utcnow().isoformat(), "test": True})
        results["document_write"] = "SUCCESS"
        
        # Test 4: Document read
        doc = doc_ref.get()
        if doc.exists:
            results["document_read"] = "SUCCESS"
            results["document_data"] = doc.to_dict()
        else:
            results["document_read"] = "FAILED - Document not found"
        
        # Test 5: Collection query
        docs = list(test_collection.limit(1).stream())
        results["collection_query"] = f"SUCCESS - Found {len(docs)} documents"
        
        # Test 6: Document delete
        doc_ref.delete()
        results["document_delete"] = "SUCCESS"
        
        return {"success": True, "operations": results}
    except Exception as e:
        import traceback
        results["error"] = str(e)
        results["trace"] = traceback.format_exc()
        return {"success": False, "operations": results}

@app.get("/debug/auth")
def debug_auth():
    """Test authentication without requiring actual auth"""
    try:
        from backend.auth import security
        import firebase_admin
        
        return {
            "firebase_admin_initialized": len(firebase_admin._apps) > 0,
            "firebase_apps_count": len(firebase_admin._apps),
            "security_configured": bool(security),
            "auth_module_loaded": True
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}

@app.post("/debug/test-auth-flow")
def debug_auth_flow(request_body: dict):
    """Test authentication flow step by step to isolate hanging point"""
    try:
        import firebase_admin
        from firebase_admin import auth as admin_auth
        
        # Get token from request
        token = request_body.get("token")
        if not token:
            return {"error": "No token provided in request body"}
        
        logging.info("[DEBUG AUTH] Starting token verification")
        
        # Step 1: Test Firebase token verification
        try:
            decoded_token = admin_auth.verify_id_token(token)
            logging.info(f"[DEBUG AUTH] Token verification SUCCESS: {decoded_token.get('uid')}")
        except Exception as e:
            logging.error(f"[DEBUG AUTH] Token verification FAILED: {str(e)}")
            return {
                "step": "firebase_token_verification", 
                "status": "FAILED",
                "error": str(e)
            }
        
        # Step 2: Test Firestore user lookup
        try:
            from google.cloud import firestore
            db = firestore.Client()
            uid = decoded_token["uid"]
            logging.info(f"[DEBUG AUTH] Starting Firestore lookup for UID: {uid}")
            
            user_doc = db.collection("users").document(uid).get()
            logging.info(f"[DEBUG AUTH] Firestore lookup SUCCESS: exists={user_doc.exists}")
            
            return {
                "step": "complete",
                "status": "SUCCESS", 
                "firebase_verification": "SUCCESS",
                "firestore_lookup": "SUCCESS",
                "user_exists": user_doc.exists,
                "uid": uid
            }
            
        except Exception as e:
            logging.error(f"[DEBUG AUTH] Firestore lookup FAILED: {str(e)}")
            return {
                "step": "firestore_lookup",
                "status": "FAILED", 
                "firebase_verification": "SUCCESS",
                "firestore_lookup": "FAILED",
                "error": str(e)
            }
            
    except Exception as e:
        import traceback
        logging.error(f"[DEBUG AUTH] Overall auth flow FAILED: {str(e)}")
        return {
            "step": "setup",
            "status": "FAILED",
            "error": str(e),
            "trace": traceback.format_exc()
        }

@app.post("/debug/test-league-creation")
def debug_league_creation():
    """Test league creation without auth for debugging"""
    try:
        logging.info("[DEBUG] Starting test league creation")
        
        db = firestore.Client()
        logging.info("[DEBUG] Firestore client created")
        
        test_name = f"Debug League {datetime.utcnow().isoformat()}"
        test_user_id = "debug_user_123"
        
        logging.info(f"[DEBUG] Creating league with name: {test_name}")
        
        # Create league document
        league_ref = db.collection("leagues").document()
        logging.info(f"[DEBUG] League document reference created: {league_ref.id}")
        
        league_ref.set({
            "name": test_name,
            "created_by_user_id": test_user_id,
            "created_at": datetime.utcnow().isoformat(),
        })
        logging.info("[DEBUG] League document written to Firestore")
        
        # Create member document
        member_ref = league_ref.collection("members").document(test_user_id)
        logging.info("[DEBUG] Creating member document")
        
        member_ref.set({
            "role": "organizer",
            "joined_at": datetime.utcnow().isoformat(),
        })
        logging.info("[DEBUG] Member document written to Firestore")
        
        logging.info(f"[DEBUG] League creation completed successfully: {league_ref.id}")
        
        return {
            "success": True,
            "league_id": league_ref.id,
            "message": "League created successfully without authentication"
        }
        
    except Exception as e:
        import traceback
        logging.error(f"[DEBUG] League creation failed: {str(e)}")
        logging.error(f"[DEBUG] Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "error": str(e),
            "trace": traceback.format_exc()
        }

@app.post("/debug/test-token-direct")
def test_token_directly(request_body: dict):
    """Test token verification directly without middleware dependencies"""
    try:
        token = request_body.get("token")
        if not token:
            return {"error": "No token provided"}
        
        logging.info(f"[DEBUG TOKEN] Testing token directly: {token[:20]}...")
        
        # Import and test token verification with timeout
        from firebase_admin import auth as admin_auth
        import concurrent.futures
        
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(admin_auth.verify_id_token, token)
                decoded_token = future.result(timeout=10)
                
            return {
                "success": True,
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "email_verified": decoded_token.get("email_verified"),
                "message": "Token verification successful"
            }
        except concurrent.futures.TimeoutError:
            return {
                "success": False,
                "error": "Token verification timed out after 10 seconds"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Token verification failed: {str(e)}"
            }
            
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "trace": traceback.format_exc()
        }

class DebugHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Debug-Header"] = "true"
        return response

app.add_middleware(DebugHeaderMiddleware)

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