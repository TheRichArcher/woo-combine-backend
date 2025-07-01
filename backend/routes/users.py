from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import logging
from datetime import datetime
from ..auth import get_current_user
from ..firestore_client import get_firestore_client

router = APIRouter()

class SetRoleRequest(BaseModel):
    role: str

@router.get("/me", summary="Get current user profile")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile information"""
    try:
        uid = current_user["uid"]
        email = current_user.get("email", "")
        role = current_user.get("role")
        
        db = get_firestore_client()
        user_doc = db.collection("users").document(uid).get()
        
        if not user_doc.exists:
            # Return basic info if user document doesn't exist yet
            return {
                "id": uid,
                "email": email,
                "role": role,
                "created_at": None
            }
        
        user_data = user_doc.to_dict()
        
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
        
        # Update or create user document with role
        user_data = {
            "id": uid,
            "email": email,
            "role": role,
            "created_at": datetime.utcnow().isoformat()
        }
        
        db.collection("users").document(uid).set(user_data, merge=True)
        
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