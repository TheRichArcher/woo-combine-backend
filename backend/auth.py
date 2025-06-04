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

# Initialize Firebase Admin SDK if not already initialized
if not firebase_admin._apps:
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        logging.info(f"Decoded Firebase token: {decoded_token}")
        if not decoded_token.get("email_verified"):
            raise HTTPException(status_code=403, detail="Email not verified")
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        # Fetch role from Firestore
        db = firestore.Client()
        user_doc = db.collection("users").document(uid).get()
        if not user_doc.exists:
            logging.warning(f"User with UID {uid} not found in Firestore.")
            raise HTTPException(status_code=403, detail="User not found in Firestore")
        user_data = user_doc.to_dict()
        role = user_data.get("role")
        if not role:
            logging.warning(f"User with UID {uid} found in Firestore but missing 'role' field.")
            raise HTTPException(status_code=403, detail="User role not set in Firestore")
        return {"uid": uid, "email": email, "role": role}
    except firebase_exceptions.FirebaseError as e:
        logging.error(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase token verification failed: {e}",
        )
    except Exception as e:
        logging.error(f"Unexpected error in get_current_user: {e}")
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