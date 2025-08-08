from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import logging
from datetime import datetime
from functools import lru_cache
import time
from firebase_admin import auth
from ..auth import get_current_user
from ..firestore_client import get_firestore_client
import os

router = APIRouter(prefix="/users")

class SetRoleRequest(BaseModel):
    role: str

# PERFORMANCE OPTIMIZATION: Cache user profiles for 5 minutes to reduce database calls
@lru_cache(maxsize=1000)
def _get_cached_user_profile(uid: str, cache_time: int):
    """Cache user profiles using 5-minute time buckets for automatic invalidation"""
    try:
        db = get_firestore_client()
        user_doc = db.collection("users").document(uid).get()
        
        if not user_doc.exists:
            return None
        
        return user_doc.to_dict()
    except Exception as e:
        logging.error(f"Error in cached user profile lookup: {e}")
        return None

@router.get("/me", summary="Get current user profile")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile information with caching"""
    try:
        uid = current_user["uid"]
        email = current_user.get("email", "")
        role = current_user.get("role")
        
        # PERFORMANCE: Use cached lookup with 5-minute invalidation
        cache_time = int(time.time() // 300)  # 5-minute time buckets
        user_data = _get_cached_user_profile(uid, cache_time)
        
        if not user_data:
            # Return basic info if user document doesn't exist yet
            return {
                "id": uid,
                "email": email,
                "role": role,
                "created_at": None
            }
        
        return {
            "id": uid,
            "email": email,
            "role": role,
            "created_at": user_data.get("created_at")
        }
        
    except Exception as e:
        logging.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")

@router.post("/role", summary="Set user role")
async def set_user_role(
    role_data: SetRoleRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    """Set the role for the current user with simplified auth for onboarding"""
    try:
        # SIMPLIFIED AUTH: Direct Firebase token verification for role setting
        token = credentials.credentials
        
        try:
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token["uid"]
            email = decoded_token.get("email", "")
            
            # For role setting, be more lenient with email verification
            # (user might have just verified but token hasn't refreshed)
            email_verified = decoded_token.get("email_verified", False)
            if not email_verified:
                # Check token age - allow role setting for recent tokens
                import time
                token_issued_at = decoded_token.get("iat", 0)
                current_time = time.time()
                
                if current_time - token_issued_at > 300:  # 5 minutes
                    raise HTTPException(
                        status_code=403, 
                        detail="Email verification required. Please check your email and verify your account."
                    )
                # Otherwise, allow it (likely verification delay)
                
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Firebase token verification failed for role setting: {e}")
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        
        role = role_data.role
        
        if not role or role not in ["organizer", "coach", "viewer", "player"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Database operations with comprehensive error handling
        try:
            db = get_firestore_client()
            if not db:
                logging.error("Firestore client is None")
                raise HTTPException(status_code=500, detail="Database connection failed")
            
            logging.info(f"Setting role for user {uid}: {role}")
            
            # Test Firestore connectivity first
            try:
                # Try a simple operation to test connection
                test_doc = db.collection("_test").document("connectivity").get()
                logging.info("Firestore connectivity test passed")
            except Exception as conn_error:
                logging.error(f"Firestore connectivity test failed: {conn_error}")
                logging.error(f"Connectivity error type: {type(conn_error).__name__}")
                raise HTTPException(status_code=500, detail="Database connectivity issue")
            
            # Check if user document exists, create or update accordingly
            user_doc_ref = db.collection("users").document(uid)
            
            try:
                user_doc = user_doc_ref.get()
                logging.info(f"Successfully retrieved user document. Exists: {user_doc.exists}")
            except Exception as get_error:
                logging.error(f"Failed to get user document: {get_error}")
                logging.error(f"Get error type: {type(get_error).__name__}")
                raise HTTPException(status_code=500, detail="Failed to read user data")
            
            try:
                if user_doc.exists:
                    # Document exists - only update the role
                    role_update = {
                        "role": role
                    }
                    user_doc_ref.update(role_update)
                    logging.info(f"✅ Updated role for existing user {uid}: {role}")
                else:
                    # Document doesn't exist - create it with minimal data
                    user_data = {
                        "id": uid,
                        "email": email,
                        "role": role,
                        "created_at": datetime.utcnow().isoformat()
                    }
                    user_doc_ref.set(user_data)
                    logging.info(f"✅ Created new user document for {uid} with role: {role}")
            except Exception as write_error:
                logging.error(f"Failed to write user role: {write_error}")
                logging.error(f"Write error type: {type(write_error).__name__}")
                logging.error(f"Write error args: {write_error.args}")
                raise HTTPException(status_code=500, detail="Failed to save role to database")
            
            # PERFORMANCE: Clear cache after role update to ensure fresh data
            try:
                _get_cached_user_profile.cache_clear()
            except Exception as cache_error:
                logging.warning(f"Failed to clear cache (non-critical): {cache_error}")
            
            return {
                "id": uid,
                "email": email,
                "role": role,
                "message": "Role set successfully"
            }
            
        except HTTPException:
            raise
        except Exception as db_error:
            logging.error(f"Unexpected database error during role setting: {db_error}")
            logging.error(f"Unexpected error type: {type(db_error).__name__}")
            logging.error(f"Unexpected error args: {db_error.args}")
            raise HTTPException(status_code=500, detail="Failed to save role to database")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error setting user role: {e}")
        raise HTTPException(status_code=500, detail="Failed to set user role")

# Debug endpoints should be disabled in production
@router.post("/debug-role", summary="Debug role setting with simplified auth")
async def debug_set_user_role(
    role_data: SetRoleRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    """Debug endpoint for role setting with detailed logging"""
    try:
        # Disable in production unless explicitly enabled
        if os.getenv("ENABLE_DEBUG_ENDPOINTS", "false").lower() not in ("1", "true", "yes"):
            raise HTTPException(status_code=404, detail="Not Found")
        logging.info(f"[DEBUG-ROLE] Starting role setting debug")
        
        # Very basic Firebase token verification
        token = credentials.credentials
        logging.info(f"[DEBUG-ROLE] Token received: {token[:20]}...")
        
        try:
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token["uid"]
            email = decoded_token.get("email", "")
            logging.info(f"[DEBUG-ROLE] Token verified for UID: {uid}, Email: {email}")
        except Exception as e:
            logging.error(f"[DEBUG-ROLE] Token verification failed: {e}")
            return {"error": f"Token verification failed: {str(e)}", "success": False}
        
        role = role_data.role
        logging.info(f"[DEBUG-ROLE] Role to set: {role}")
        
        # Test Firestore connection
        try:
            db = get_firestore_client()
            logging.info(f"[DEBUG-ROLE] Firestore client obtained: {type(db)}")
            
            # Simple connectivity test
            test_doc = db.collection("_debug").document("test").get()
            logging.info(f"[DEBUG-ROLE] Connectivity test passed")
            
            # Try to create a simple test document
            test_data = {"test": "value", "timestamp": datetime.utcnow().isoformat()}
            db.collection("_debug").document(f"test_{uid}").set(test_data)
            logging.info(f"[DEBUG-ROLE] Test document created successfully")
            
            return {
                "success": True,
                "message": "Debug test passed - Firestore is working",
                "uid": uid,
                "email": email,
                "role": role
            }
            
        except Exception as db_error:
            logging.error(f"[DEBUG-ROLE] Database error: {db_error}")
            logging.error(f"[DEBUG-ROLE] Error type: {type(db_error).__name__}")
            return {
                "success": False,
                "error": f"Database error: {str(db_error)}",
                "error_type": type(db_error).__name__
            }
            
    except Exception as e:
        logging.error(f"[DEBUG-ROLE] Unexpected error: {e}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "error_type": type(e).__name__
        }

# Extremely permissive endpoint – guard with env flag and disable by default
@router.post("/role-simple", summary="Simple role setting for onboarding issues")
async def set_user_role_simple(
    role_data: SetRoleRequest,
    request: Request
):
    """
    Simplified role setting endpoint for Firebase configuration issues.
    Uses basic auth header extraction without complex verification.
    """
    # Only allow when explicitly enabled via environment variable
    import os
    if os.getenv("ENABLE_ROLE_SIMPLE", "false").lower() not in ("1", "true", "yes"): 
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        logging.info(f"[SIMPLE-ROLE] Starting simplified role setting")
        
        # Extract auth header manually
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No valid authorization header")
        
        token = auth_header.replace("Bearer ", "")
        
        # Try to decode token without verification to get UID
        try:
            import base64
            import json
            
            # JWT tokens have 3 parts separated by dots
            parts = token.split('.')
            if len(parts) != 3:
                raise ValueError("Invalid token format")
            
            # Decode the payload (second part)
            # Add padding if needed
            payload = parts[1]
            payload += '=' * (4 - len(payload) % 4)
            decoded_payload = base64.urlsafe_b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            uid = token_data.get("user_id") or token_data.get("uid")
            email = token_data.get("email", "")
            
            if not uid:
                raise ValueError("No UID found in token")
                
            logging.info(f"[SIMPLE-ROLE] Extracted UID: {uid}, Email: {email}")
            
        except Exception as token_error:
            logging.error(f"[SIMPLE-ROLE] Token parsing failed: {token_error}")
            raise HTTPException(status_code=401, detail="Invalid token format")
        
        role = role_data.role
        if not role or role not in ["organizer", "coach", "viewer", "player"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        logging.info(f"[SIMPLE-ROLE] Setting role {role} for user {uid}")
        
        # Direct Firestore operation
        try:
            db = get_firestore_client()
            if not db:
                raise HTTPException(status_code=500, detail="Database connection failed")
            
            # Create/update user document
            user_data = {
                "id": uid,
                "email": email,
                "role": role,
                "created_at": datetime.utcnow().isoformat(),
                "auth_method": "simple_role_setting"  # Track how this was set
            }
            
            user_doc_ref = db.collection("users").document(uid)
            user_doc_ref.set(user_data, merge=True)  # Use merge to avoid overwriting
            
            logging.info(f"[SIMPLE-ROLE] ✅ Role set successfully for {uid}: {role}")
            
            return {
                "id": uid,
                "email": email,
                "role": role,
                "message": "Role set successfully (simple method)",
                "method": "simplified"
            }
            
        except Exception as db_error:
            logging.error(f"[SIMPLE-ROLE] Database error: {db_error}")
            logging.error(f"[SIMPLE-ROLE] Error type: {type(db_error).__name__}")
            raise HTTPException(status_code=500, detail=f"Database operation failed: {str(db_error)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[SIMPLE-ROLE] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Role setting failed")