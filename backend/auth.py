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

from backend.models import User

# Initialize Firebase app once using environment secret
if not firebase_admin._apps:
    try:
        firebase_json = os.environ["FIREBASE_SERVICE_JSON"]
        cred_data = json.loads(firebase_json)
        cred = credentials.Certificate(cred_data)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Firebase Admin SDK: {e}")

security = HTTPBearer()

# List of admin emails
ADMIN_EMAILS = {"usagrich@aol.com"}

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        logging.info(f"Decoded Firebase token: {decoded_token}")
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        return User(id=uid, email=email)
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