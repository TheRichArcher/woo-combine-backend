import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from firebase_admin import exceptions as firebase_exceptions
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import json

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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        return User(id=uid, email=email)
    except firebase_exceptions.FirebaseError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase token verification failed: {e}",
        ) 