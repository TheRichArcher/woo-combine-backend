from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import logging
from datetime import datetime
from ..auth import get_current_user
from ..firestore_client import get_firestore_client

router = APIRouter()

class SetRoleRequest(BaseModel):
    role: str

@router.get("/users/me")
def get_current_user_info(
    request: Request,
    current_user=Depends(get_current_user)
):
    """Get current user information including role"""
    
    user_id = current_user["uid"]
    email = current_user["email"]
    
    logging.info(f"[USER-INFO] Fetching user info for {user_id}")
    
    try:
        db = get_firestore_client()
        
        # Get user document
        user_doc = db.collection("users").document(user_id).get()
        
        if not user_doc.exists:
            logging.warning(f"[USER-INFO] User document not found for {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = user_doc.to_dict()
        
        logging.info(f"[USER-INFO] Successfully fetched user info for {user_id}, role: {user_data.get('role', 'none')}")
        
        return {
            "id": user_id,
            "email": email,
            "role": user_data.get("role"),
            "updated_at": user_data.get("updated_at"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[USER-INFO] Failed to fetch user info for {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user information: {str(e)}"
        )

@router.post("/users/role")
def set_user_role(
    request: Request,
    req: SetRoleRequest,
    current_user=Depends(get_current_user)
):
    """Set or update user role - used during onboarding"""
    
    user_id = current_user["uid"]
    email = current_user["email"]
    role = req.role
    
    logging.info(f"[USER-ROLE] Setting role '{role}' for user {user_id}")
    
    # Validate role
    valid_roles = ["organizer", "coach", "viewer"]
    if role not in valid_roles:
        logging.error(f"[USER-ROLE] Invalid role '{role}' provided")
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    try:
        db = get_firestore_client()
        
        # Update or create user document with role
        user_data = {
            "id": user_id,
            "email": email,
            "role": role,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Use merge=True to update existing document or create if not exists
        db.collection("users").document(user_id).set(user_data, merge=True)
        
        logging.info(f"[USER-ROLE] Successfully set role '{role}' for user {user_id}")
        
        return {
            "success": True,
            "message": f"Role '{role}' set successfully",
            "user_id": user_id,
            "role": role
        }
        
    except Exception as e:
        logging.error(f"[USER-ROLE] Failed to set role for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set user role: {str(e)}"
        ) 