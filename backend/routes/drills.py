from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List
from pydantic import BaseModel
from ..models import DrillResultSchema
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit
from ..firestore_client import db
from google.cloud.firestore import Query as FsQuery, FieldValue
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
        
        # Activate Live Entry mode for the event (locks custom drills)
        # Only update if not already active to save writes
        execute_with_timeout(
            lambda: event_ref.update({"live_entry_active": True}),
            timeout=5,
            operation_name="activate live entry"
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

@router.delete("/drill-results/{result_id}")
@write_rate_limit()
@require_permission(
    "drills",
    "delete_result",
    target="event",
    target_getter=lambda kwargs: kwargs.get("event_id"),
)
def delete_drill_result(
    request: Request,
    result_id: str,
    event_id: str = Query(..., regex=r"^.{1,50}$"),
    player_id: str = Query(..., regex=r"^.{1,50}$"),
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Delete a specific drill result and revert the player's current score 
    to the most recent previous entry (or remove it if none exist).
    """
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        player_ref = db.collection("events").document(event_id).collection("players").document(player_id)
        result_ref = player_ref.collection("drill_results").document(result_id)
        
        # Get the result to identify the drill type before deleting
        result_doc = execute_with_timeout(lambda: result_ref.get(), timeout=5)
        
        if not result_doc.exists:
            raise HTTPException(status_code=404, detail="Drill result not found")
            
        drill_type = result_doc.to_dict().get("type")
        
        # Delete the result
        execute_with_timeout(lambda: result_ref.delete(), timeout=5)
        
        # Find the next most recent result for this drill type to revert to
        results_query = (
            player_ref.collection("drill_results")
            .where("type", "==", drill_type)
            .order_by("created_at", direction=FsQuery.DESCENDING)
            .limit(1)
        )
        
        previous_results = execute_with_timeout(lambda: list(results_query.stream()), timeout=5)
        
        if previous_results:
            # Revert to previous score
            previous_value = previous_results[0].to_dict().get("value")
            execute_with_timeout(
                lambda: player_ref.update({drill_type: previous_value}),
                timeout=5
            )
            logging.info(f"Reverted {drill_type} for player {player_id} to {previous_value}")
        else:
            # No previous scores, remove the field
            execute_with_timeout(
                lambda: player_ref.update({drill_type: FieldValue.delete()}),
                timeout=5
            )
            logging.info(f"Removed {drill_type} for player {player_id} (no previous scores)")
            
        return {"message": "Drill result deleted and score reverted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting drill result: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete drill result")
