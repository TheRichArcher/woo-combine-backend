from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, credentials, initialize_app
from backend.models import User
from starlette.status import HTTP_401_UNAUTHORIZED
import firebase_admin
import os

# Only initialize Firebase once
if not firebase_admin._apps:
    cred_path = os.path.join(os.path.dirname(__file__), "../firebase/woo-combine-firebase-adminsdk-fbsvc-de153fde66.json")
    cred = credentials.Certificate(cred_path)
    initialize_app(cred)

security = HTTPBearer()

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token["uid"]
        email = decoded_token["email"]
        return User(id=user_id, email=email)
    except Exception as e:
        print("[Auth] Token verification failed:", e)
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) 