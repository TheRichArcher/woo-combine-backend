from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from pydantic import BaseModel
from ..models import DrillResultSchema
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit
from ..firestore_client import db
import logging
from datetime import datetime
from ..utils.database import execute_with_timeout
from ..utils.validation import validate_drill_score, get_unit_for_drill
from ..utils.data_integrity import enforce_event_league_relationship
from ..security.access_matrix import require_permission

router = APIRouter()

# Drill endpoints are now managed as subcollections under players in Firestore.
# Implement additional drill-related endpoints here if needed in the future.

class DrillResultCreate(BaseModel):
    player_id: str
    type: str
    value: float
    event_id: str
    recorded_at: str | None = None
    notes: str | None = None

@router.post("/drill-results/", response_model=dict)
@write_rate_limit()
@require_permission(
    "drills",
    "create_result",
    target="event",
    target_getter=lambda kwargs: getattr(kwargs.get("result"), "event_id", None),
)
def create_drill_result(
    request: Request,
    result: DrillResultCreate,
    current_user=Depends(require_role("organizer", "coach"))
):
    """Create a new drill result for a player"""
    try:
        enforce_event_league_relationship(event_id=result.event_id)

        event_ref = db.collection("events").document(result.event_id)
        
        # Validate that the player exists in the event with timeout protection
        player_ref = event_ref.collection("players").document(result.player_id)
        player_doc = execute_with_timeout(
            player_ref.get,
            timeout=5
        )
        
        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Validate value and attach unit
        validated_value = validate_drill_score(float(result.value), result.type)
        unit = get_unit_for_drill(result.type)
        now_iso = datetime.utcnow().isoformat()
        drill_result_data = {
            "player_id": result.player_id,
            "type": result.type,
            "value": validated_value,
            "unit": unit,
            "event_id": result.event_id,
            "created_at": now_iso,
            "recorded_at": result.recorded_at or now_iso,
            "notes": result.notes or "",
            "created_by": current_user["uid"]
        }
        
        # Store drill result as a subcollection under the player with timeout protection
        drill_results_ref = player_ref.collection("drill_results")
        doc_ref = drill_results_ref.document()
        execute_with_timeout(
            lambda: doc_ref.set(drill_result_data),
            timeout=10
        )
        
        # Also update the player's main drill score field for easier querying
        drill_field_name = result.type
        
        # Update player document with the new drill score with timeout protection
        execute_with_timeout(
            lambda: player_ref.update({drill_field_name: validated_value}),
            timeout=10
        )
        
        logging.info(f"Drill result created for player {result.player_id}, type: {result.type}, value: {result.value}")
        
        return {
            "id": doc_ref.id,
            "message": "Drill result created successfully",
            "drill_result": drill_result_data
        }
        
    except Exception as e:
        logging.error(f"Error creating drill result: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create drill result: {str(e)}")
