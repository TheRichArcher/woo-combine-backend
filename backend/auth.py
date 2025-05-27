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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        logging.info(f"Decoded Firebase token: {decoded_token}")
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")

        # --- Firestore logic ---
        db = firestore.Client()
        user_ref = db.collection("users").document(uid)
        user_doc = user_ref.get()
        if not user_doc.exists:
            # Determine role
            role = "admin" if email in ADMIN_EMAILS else "coach"
            user_data = {
                "email": email,
                "role": role,
                "created_at": datetime.utcnow(),
            }
            user_ref.set(user_data)
            logging.info(f"Created new user in Firestore: {user_data}")
        else:
            # Optionally, update email if changed
            doc_data = user_doc.to_dict()
            if doc_data.get("email") != email:
                user_ref.update({"email": email})
            logging.info(f"User found in Firestore: {doc_data}")
        # --- End Firestore logic ---

        logging.info(f"Returning user: uid={uid}, email={email}")
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