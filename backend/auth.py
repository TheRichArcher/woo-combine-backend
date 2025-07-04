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
import concurrent.futures
from functools import wraps

# Initialize Firebase Admin SDK if not already initialized
if not firebase_admin._apps:
    # Debug: Log available environment variables
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    
    logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS_JSON exists: {bool(creds_json)}")
    logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS exists: {bool(creds_path)}")
    if creds_path:
        logging.info(f"[AUTH] GOOGLE_APPLICATION_CREDENTIALS value starts with: {creds_path[:50]}...")
    
    # Try JSON content first (from environment variable)
    if creds_json:
        try:
            cred_dict = json.loads(creds_json)
            cred = credentials.Certificate(cred_dict)
            logging.info("[AUTH] Firebase initialized with JSON credentials from environment")
        except Exception as e:
            logging.error(f"[AUTH] Failed to parse JSON credentials: {e}")
            cred = credentials.ApplicationDefault()
    else:
        # NO fallback to file path - if JSON is not provided, use Application Default
        logging.info("[AUTH] No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using Application Default")
        cred = credentials.ApplicationDefault()
    
    firebase_admin.initialize_app(cred)

from .firestore_client import get_firestore_client

security = HTTPBearer(auto_error=False)

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
        logging.info(f"[AUTH] Starting token verification for token: {token[:20]}...")
        
        # Simplified Firebase token verification with shorter timeout
        try:
            decoded_token = auth.verify_id_token(token)
            logging.info(f"[AUTH] Token verification completed successfully")
        except Exception as e:
            logging.error(f"[AUTH] Firebase token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        logging.info(f"[AUTH] Decoded Firebase token for UID: {decoded_token.get('uid')}")
        
        # Check if user has verified their email
        if not decoded_token.get("email_verified", False):
            logging.warning(f"[AUTH] User {decoded_token.get('uid')} has not verified their email")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required. Please check your email and verify your account."
            )
            
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        
        # Optimized Firestore lookup with timeout protection
        logging.info(f"[AUTH] Starting Firestore lookup for UID: {uid}")
        try:
            db = get_firestore_client()
            
            # Add timeout protection to Firestore lookup
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(lambda: db.collection("users").document(uid).get())
                try:
                    user_doc = future.result(timeout=10)  # Increased to 10 seconds for extreme cold starts
                    logging.info(f"[AUTH] Firestore lookup completed")
                except concurrent.futures.TimeoutError:
                    logging.error(f"[AUTH] Firestore lookup timed out after 10 seconds for UID: {uid}")
                    raise HTTPException(
                        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                        detail="Authentication service temporarily unavailable due to server startup"
                    )
            
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
                
                # Create the user document
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(lambda: db.collection("users").document(uid).set(user_data))
                    try:
                        future.result(timeout=5)  # 5 second timeout for user creation
                        logging.info(f"[AUTH] Successfully created user document for UID {uid}")
                        
                        # Return with no role so user goes to SelectRole
                        return {"uid": uid, "email": email, "role": None}
                        
                    except concurrent.futures.TimeoutError:
                        logging.error(f"[AUTH] User document creation timed out for UID: {uid}")
                        # Continue without role to allow SelectRole flow
                        return {"uid": uid, "email": email, "role": None}
                        
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
            return {"uid": uid, "email": stored_email, "role": None}
            
        logging.info(f"[AUTH] Authentication successful for UID {uid} with role {role}")
        return {"uid": uid, "email": stored_email, "role": role}
        
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

def require_role(*allowed_roles):
    def wrapper(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Access denied")
        return user
    return wrapper 