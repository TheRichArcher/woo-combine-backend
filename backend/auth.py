import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status, Request
from firebase_admin import exceptions as firebase_exceptions
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import json
from google.cloud import firestore
from datetime import datetime
import logging
import asyncio
from functools import wraps, lru_cache
import time

# Initialize Firebase Admin SDK robustly for test/dev environments
try:
    if not firebase_admin._apps:
        # Debug: Log available environment variables
        creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        
        logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS_JSON exists: {bool(creds_json)}")
        logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS exists: {bool(creds_path)}")
        if creds_path:
            logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS value starts with: {creds_path[:50]}...")

        cred = None
        # Try JSON content first (from environment variable)
        if creds_json:
            try:
                cred_dict = json.loads(creds_json)
                cred = credentials.Certificate(cred_dict)
                logging.info("[AUTH] Using JSON credentials from environment")
            except Exception as e:
                logging.warning(f"[AUTH] Failed to parse JSON credentials: {e}")
                cred = None
        if cred is None:
            try:
                logging.info("[AUTH] Attempting Application Default Credentials")
                cred = credentials.ApplicationDefault()
            except Exception as e:
                logging.warning(f"[AUTH] ADC not available: {e}")
                cred = None

        try:
            if cred is not None:
                firebase_admin.initialize_app(cred)
            else:
                # Initialize without explicit credentials; suitable for tests where calls are mocked
                firebase_admin.initialize_app()
            logging.info("[AUTH] Firebase Admin initialized")
        except Exception as e:
            logging.warning(f"[AUTH] Firebase initialize_app failed, continuing in degraded mode: {e}")
except Exception as e:
    logging.warning(f"[AUTH] Firebase admin init block failed: {e}")

from .firestore_client import get_firestore_client

security = HTTPBearer(auto_error=False)

# Configurable verification behavior (to mitigate transient infra issues)
AUTH_CHECK_REVOKED = os.getenv("AUTH_CHECK_REVOKED", "true").lower() in ("1", "true", "yes", "on")
AUTH_FALLBACK_NO_REVOKE = os.getenv("AUTH_FALLBACK_NO_REVOKE", "true").lower() in ("1", "true", "yes", "on")

def _verify_id_token(token: str, check_revoked: bool = True):
    """Verify an ID token with optional revocation checking.
    Gracefully handle environments where the verify function signature differs (tests).
    """
    try:
        return auth.verify_id_token(token, check_revoked=check_revoked)
    except TypeError:
        # Mocked functions in tests may not accept check_revoked
        return auth.verify_id_token(token)

def _enforce_session_max_age(decoded_token: dict):
    """Reject sessions older than configured max age (default 24h)."""
    try:
        max_age_secs = int(os.getenv("MAX_SESSION_AGE_SECS", str(24 * 3600)))
        if max_age_secs <= 0:
            return
        now = int(time.time())
        auth_time = int(decoded_token.get("auth_time") or decoded_token.get("iat") or 0)
        if auth_time and now - auth_time > max_age_secs:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session too old")
    except HTTPException:
        raise
    except Exception:
        # Do not block if claim missing/malformed
        pass

# Optional global toggle: require verified email for any login (not just role-gated routes)
REQUIRE_VERIFIED_LOGIN = os.getenv("REQUIRE_VERIFIED_LOGIN", "false").lower() in ("1", "true", "yes", "on")

def _ensure_verified(decoded_token: dict):
    if REQUIRE_VERIFIED_LOGIN and not decoded_token.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified")

# Cache disabled-user check briefly to avoid Admin API calls on every request
@lru_cache(maxsize=2048)
def _is_user_disabled_cached(uid: str, bucket: int) -> bool:
    try:
        user_record = auth.get_user(uid)
        return bool(getattr(user_record, "disabled", False))
    except Exception as e:
        # Treat failures as not disabled; downstream logic is best-effort only
        logging.debug(f"[AUTH] Disabled check skipped (cached) for {uid}: {e}")
        return False

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    # Skip authentication for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        logging.info("[AUTH] Skipping authentication for OPTIONS request")
        return {"uid": "options", "email": "options@system", "role": "system"}
    
    # Check if credentials are provided
    if not credentials:
        logging.error("[AUTH] No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required"
        )
        
    token = credentials.credentials
    try:
        logging.info("[AUTH] Starting token verification")
        
        # Verification with configurable revocation enforcement and optional fallback
        try:
            decoded_token = _verify_id_token(token, check_revoked=AUTH_CHECK_REVOKED)
            logging.info("[AUTH] Token verification completed successfully")
        except getattr(auth, "RevokedIdTokenError", Exception) as revoked_err:
            logging.warning(f"[AUTH] Token has been revoked: {type(revoked_err).__name__}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token revoked. Please sign in again."
            )
        except Exception as e:
            # If strict verification fails and fallback is enabled, try without revocation check
            err_type = type(e).__name__
            logging.error(f"[AUTH] Firebase token verification failed ({err_type}): {e}")
            if AUTH_CHECK_REVOKED and AUTH_FALLBACK_NO_REVOKE:
                try:
                    logging.warning("[AUTH] Retrying token verification without revocation check due to error above")
                    decoded_token = _verify_id_token(token, check_revoked=False)
                    logging.info("[AUTH] Token verification succeeded without revocation check")
                except Exception as e2:
                    err_type2 = type(e2).__name__
                    logging.error(f"[AUTH] Fallback token verification failed ({err_type2}): {e2}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid authentication token"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token"
                )
        
        # Enforce max session age
        _enforce_session_max_age(decoded_token)
        # Optionally require verified email globally
        _ensure_verified(decoded_token)
        logging.info(f"[AUTH] Decoded Firebase token for UID: {decoded_token.get('uid')}")
        
        # Note: Do not block unverified emails here. Verification is enforced on role-gated routes.
        email_verified = decoded_token.get("email_verified", False)
        
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        
        # Optional: deny disabled users using short-lived cached check (5-minute buckets)
        try:
            bucket = int(time.time() // 300)
            if _is_user_disabled_cached(uid, bucket):
                logging.warning(f"[AUTH] Disabled user attempted access: {uid}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User disabled")
        except Exception as e:
            logging.debug(f"[AUTH] Disabled check (cached) non-fatal error: {e}")
        
        # Simple direct Firestore lookup (ThreadPoolExecutor was causing delays)
        logging.info(f"[AUTH] Starting Firestore lookup for UID: {uid}")
        try:
            db = get_firestore_client()
            logging.info(f"[AUTH] Firestore client obtained successfully")
            
            # Direct Firestore call - much faster than ThreadPoolExecutor
            user_doc = db.collection("users").document(uid).get()
            logging.info(f"[AUTH] Firestore lookup completed successfully. User exists: {user_doc.exists}")
            
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"[AUTH] Firestore lookup failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database lookup failed"
            )
        
        if not user_doc.exists:
            # GUIDED SETUP FIX: Auto-create user document for new users to enable onboarding
            logging.info(f"[AUTH] Creating new user document for UID {uid} to enable guided setup")
            try:
                # Create minimal user document to allow access
                user_data = {
                    "id": uid,
                    "email": email,
                    "created_at": datetime.utcnow().isoformat(),
                    # Don't set role yet - this will be done in SelectRole
                }
                
                # Create the user document directly (ThreadPoolExecutor was causing delays)
                db.collection("users").document(uid).set(user_data)
                logging.info(f"[AUTH] Successfully created user document for UID {uid}")
                
                # Return with no role so user goes to SelectRole
                return {"uid": uid, "email": email, "role": None, "email_verified": email_verified}
                        
            except Exception as create_error:
                logging.error(f"[AUTH] Failed to create user document: {create_error}")
                # Still allow access without role for SelectRole flow
                return {"uid": uid, "email": email, "role": None}
        
        user_data = user_doc.to_dict()
        role = user_data.get("role")
        stored_email = user_data.get("email", email)
        
        # GUIDED SETUP FIX: Allow access without role for SelectRole flow
        if not role:
            logging.info(f"[AUTH] User with UID {uid} found but no role set - allowing SelectRole access")
            return {"uid": uid, "email": stored_email, "role": None, "email_verified": email_verified}
            
        logging.info(f"[AUTH] Authentication successful for UID {uid} with role {role}")
        return {"uid": uid, "email": stored_email, "role": role, "email_verified": email_verified}
        
    except firebase_exceptions.FirebaseError as e:
        logging.error(f"[AUTH] Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase token verification failed: {e}",
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like timeouts) without wrapping
        raise
    except Exception as e:
        logging.error(f"[AUTH] Unexpected error in get_current_user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unexpected error in get_current_user: {e}",
        )

def get_current_user_for_role_setting(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Special auth dependency for role setting that allows unverified users
    who have just completed email verification but the token hasn't refreshed yet
    """
    # Skip authentication for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        logging.info("[AUTH] Skipping authentication for OPTIONS request")
        return {"uid": "options", "email": "options@system", "role": "system"}
    
    # Check if credentials are provided
    if not credentials:
        logging.error("[AUTH] No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required"
        )
        
    token = credentials.credentials
    try:
        logging.info(f"[AUTH] Starting token verification for role setting")
        
        # Strict verification with revocation enforcement
        try:
            decoded_token = _verify_id_token_strict(token)
            logging.info(f"[AUTH] Token verification completed successfully")
        except getattr(auth, "RevokedIdTokenError", Exception):
            logging.warning("[AUTH] Token has been revoked (role setting)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token revoked. Please sign in again."
            )
        except Exception as e:
            logging.error(f"[AUTH] Firebase token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        # Enforce max session age
        _enforce_session_max_age(decoded_token)
        
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        
        # FOR ROLE SETTING: Check email verification but allow recent verifications
        email_verified = decoded_token.get("email_verified", False)
        
        if not email_verified:
            # Check if user has very recently verified (token might be stale)
            # Allow role setting if user exists and token is recent
            import time
            token_issued_at = decoded_token.get("iat", 0)
            current_time = time.time()
            
            # If token is less than 5 minutes old, be more lenient
            if current_time - token_issued_at < 300:  # 5 minutes
                logging.info(f"[AUTH] Allowing role setting for recent token (might be verification delay)")
            else:
                logging.warning(f"[AUTH] User {uid} has not verified their email (for role setting)")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Email verification required. Please check your email and verify your account."
                )
        
        # Get user from Firestore
        logging.info(f"[AUTH] Starting Firestore lookup for role setting: {uid}")
        try:
            db = get_firestore_client()
            if not db:
                logging.error(f"[AUTH] Failed to get Firestore client")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Database connection failed"
                )
            
            user_doc = db.collection("users").document(uid).get()
            logging.info(f"[AUTH] Firestore lookup completed. User exists: {user_doc.exists}")
            
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"[AUTH] Firestore lookup failed for role setting: {e}")
            logging.error(f"[AUTH] Exception type: {type(e).__name__}")
            logging.error(f"[AUTH] Exception args: {e.args}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database lookup failed"
            )
        
        if not user_doc.exists:
            # Auto-create user document for role setting
            logging.info(f"[AUTH] Creating new user document for role setting: {uid}")
            try:
                user_data = {
                    "id": uid,
                    "email": email,
                    "created_at": datetime.utcnow().isoformat(),
                    # Don't set role yet - this will be done by the role endpoint
                }
                db.collection("users").document(uid).set(user_data)
                logging.info(f"[AUTH] Successfully created user document for role setting: {uid}")
                return {"uid": uid, "email": email, "role": None}
                        
            except Exception as create_error:
                logging.error(f"[AUTH] Failed to create user document for role setting: {create_error}")
                logging.error(f"[AUTH] Create error type: {type(create_error).__name__}")
                # Still allow the role setting to proceed
                return {"uid": uid, "email": email, "role": None}
        
        user_data = user_doc.to_dict()
        role = user_data.get("role")
        stored_email = user_data.get("email", email)
        
        logging.info(f"[AUTH] Role setting auth successful for UID {uid}")
        return {"uid": uid, "email": stored_email, "role": role}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[AUTH] Unexpected error in role setting auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {e}",
        )

def require_role(*allowed_roles):
    def wrapper(user=Depends(get_current_user)):
        # Enforce email verification on role-gated endpoints
        if not user.get("email_verified", False):
            raise HTTPException(status_code=403, detail="Email verification required")
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        return user
    return wrapper