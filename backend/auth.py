import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
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
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

security = HTTPBearer()

# Create a reusable Firestore client to avoid initialization overhead
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.Client()
    return _firestore_client

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
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
        
        if not decoded_token.get("email_verified"):
            logging.warning(f"[AUTH] Email not verified for UID: {decoded_token.get('uid')}")
            raise HTTPException(status_code=403, detail="Email not verified")
            
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        
        # Optimized Firestore lookup with reusable client
        logging.info(f"[AUTH] Starting Firestore lookup for UID: {uid}")
        try:
            db = get_firestore_client()
            user_doc = db.collection("users").document(uid).get()
            logging.info(f"[AUTH] Firestore lookup completed")
        except Exception as e:
            logging.error(f"[AUTH] Firestore lookup failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database lookup failed"
            )
        
        if not user_doc.exists:
            logging.warning(f"[AUTH] User with UID {uid} not found in Firestore.")
            raise HTTPException(status_code=403, detail="User not found in Firestore")
            
        user_data = user_doc.to_dict()
        role = user_data.get("role")
        
        if not role:
            logging.warning(f"[AUTH] User with UID {uid} found in Firestore but missing 'role' field.")
            raise HTTPException(status_code=403, detail="User role not set in Firestore")
            
        logging.info(f"[AUTH] Authentication successful for UID {uid} with role {role}")
        return {"uid": uid, "email": email, "role": role}
        
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