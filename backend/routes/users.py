from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import logging
from datetime import datetime
from functools import lru_cache
import time
from ..auth import get_current_user
from ..firestore_client import get_firestore_client

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
    current_user: dict = Depends(get_current_user)
):
    """Set the role for the current user"""
    try:
        uid = current_user["uid"]
        email = current_user.get("email", "")
        role = role_data.role
        
        if not role or role not in ["organizer", "coach", "viewer", "player"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        db = get_firestore_client()
        
        # Check if user document exists, create or update accordingly
        user_doc_ref = db.collection("users").document(uid)
        user_doc = user_doc_ref.get()
        
        if user_doc.exists:
            # Document exists - only update the role
            role_update = {
                "role": role
            }
            user_doc_ref.update(role_update)
        else:
            # Document doesn't exist - create it with minimal data
            user_data = {
                "id": uid,
                "email": email,
                "role": role,
                "created_at": datetime.utcnow().isoformat()
            }
            user_doc_ref.set(user_data)
        
        return {
            "id": uid,
            "email": email,
            "role": role,
            "message": "Role set successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error setting user role: {e}")
        raise HTTPException(status_code=500, detail="Failed to set user role") 