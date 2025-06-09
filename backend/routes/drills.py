from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel
from backend.models import DrillResultSchema
from backend.auth import get_current_user
from backend.firestore_client import db
import logging
from datetime import datetime

router = APIRouter()

# Drill endpoints are now managed as subcollections under players in Firestore.
# Implement additional drill-related endpoints here if needed in the future.

class DrillResultCreate(BaseModel):
    player_id: str
    type: str
    value: float
    league_id: str

@router.post("/drill-results/", response_model=dict)
def create_drill_result(result: DrillResultCreate, current_user=Depends(get_current_user)):
    """Create a new drill result for a player"""
    try:
        # Validate that the player exists
        player_ref = db.collection("players").document(result.player_id)
        player_doc = player_ref.get()
        
        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Create drill result data
        drill_result_data = {
            "player_id": result.player_id,
            "type": result.type,
            "value": result.value,
            "league_id": result.league_id,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": current_user["uid"]
        }
        
        # Store drill result as a subcollection under the player
        drill_results_ref = player_ref.collection("drill_results")
        doc_ref = drill_results_ref.document()
        doc_ref.set(drill_result_data)
        
        # Also update the player's main drill score field for easier querying
        drill_field_name = f"drill_{result.type}"
        
        # Update player document with the new drill score
        player_ref.update({
            drill_field_name: result.value
        })
        
        logging.info(f"Drill result created for player {result.player_id}, type: {result.type}, value: {result.value}")
        
        return {
            "id": doc_ref.id,
            "message": "Drill result created successfully",
            "drill_result": drill_result_data
        }
        
    except Exception as e:
        logging.error(f"Error creating drill result: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create drill result: {str(e)}")
