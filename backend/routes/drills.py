from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from ..auth import get_current_user, require_verified_user
from ..middleware.rate_limiting import write_rate_limit
from ..firestore_client import db
from google.cloud import firestore
import logging
from datetime import datetime
from ..utils.database import execute_with_timeout
from ..utils.data_integrity import enforce_event_league_relationship
from ..security.access_matrix import require_permission
from ..utils.event_schema import get_event_schema
from ..utils.lock_validation import check_write_permission

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


class DrillResultUpdate(BaseModel):
    value: float
    notes: str | None = None
    recorded_at: str | None = None


def _sync_player_current_score(player_ref, drill_type: str):
    """
    Recompute and persist the player's canonical score for a drill based on
    the most recent drill_result entry.
    """
    now_iso = datetime.utcnow().isoformat()
    latest_query = (
        player_ref.collection("drill_results")
        .where("type", "==", drill_type)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(1)
    )
    latest_results = execute_with_timeout(lambda: list(latest_query.stream()), timeout=5)

    if latest_results:
        latest_value = latest_results[0].to_dict().get("value")
        execute_with_timeout(
            lambda: player_ref.update(
                {
                    f"scores.{drill_type}": latest_value,
                    drill_type: latest_value,
                    "updated_at": now_iso,
                }
            ),
            timeout=5,
        )
    else:
        execute_with_timeout(
            lambda: player_ref.update(
                {
                    f"scores.{drill_type}": firestore.DELETE_FIELD,
                    drill_type: firestore.DELETE_FIELD,
                    "updated_at": now_iso,
                }
            ),
            timeout=5,
        )


@router.get("/drill-results/", response_model=dict)
@require_permission("drills", "read_result", target="event", target_param="event_id")
def list_drill_results(
    request: Request,
    event_id: str = Query(..., regex=r"^.{1,50}$"),
    player_id: str = Query(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user),
):
    try:
        enforce_event_league_relationship(event_id=event_id)

        player_ref = (
            db.collection("events")
            .document(event_id)
            .collection("players")
            .document(player_id)
        )
        player_doc = execute_with_timeout(lambda: player_ref.get(), timeout=5)
        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")

        results_query = player_ref.collection("drill_results").order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )
        results_stream = execute_with_timeout(lambda: list(results_query.stream()), timeout=10)

        results = []
        for doc in results_stream:
            data = doc.to_dict() or {}
            results.append(
                {
                    "id": doc.id,
                    "type": data.get("type"),
                    "value": data.get("value"),
                    "unit": data.get("unit"),
                    "recorded_at": data.get("recorded_at"),
                    "created_at": data.get("created_at"),
                    "created_by": data.get("created_by") or data.get("evaluator_id"),
                    "source": data.get("evaluator_name") or data.get("created_by"),
                    "notes": data.get("notes", ""),
                    "updated_at": data.get("updated_at"),
                }
            )

        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing drill results: {e}")
        raise HTTPException(status_code=500, detail="Failed to list drill results")


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
    current_user=Depends(require_verified_user),
):
    """Create a new drill result for a player"""
    try:
        enforce_event_league_relationship(event_id=result.event_id)

        # Check scoped write permission (membership role is authoritative).
        check_write_permission(
            event_id=result.event_id,
            user_id=current_user["uid"],
            operation_name="create drill result",
        )

        event_ref = db.collection("events").document(result.event_id)

        # Validate that the player exists in the event with timeout protection
        player_ref = event_ref.collection("players").document(result.player_id)
        player_doc = execute_with_timeout(player_ref.get, timeout=5)

        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")

        # Fetch schema for validation
        schema = get_event_schema(result.event_id)
        drill_def = next((d for d in schema.drills if d.key == result.type), None)

        if not drill_def:
            raise HTTPException(
                status_code=400, detail=f"Unknown drill type: {result.type}"
            )

        # Validate value against schema
        min_val = drill_def.min_value if drill_def.min_value is not None else 0
        max_val = drill_def.max_value if drill_def.max_value is not None else 9999

        if result.value < min_val or result.value > max_val:
            raise HTTPException(
                status_code=400, detail=f"Value must be between {min_val} and {max_val}"
            )

        validated_value = float(result.value)
        unit = drill_def.unit

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
            "created_by": current_user["uid"],
        }

        # Store drill result as a subcollection under the player with timeout protection
        drill_results_ref = player_ref.collection("drill_results")
        doc_ref = drill_results_ref.document()
        execute_with_timeout(lambda: doc_ref.set(drill_result_data), timeout=10)

        # Update player document with the new drill score.
        # Keep both scores map (source of truth) and legacy flat field in sync
        # so older read paths never surface stale values.
        execute_with_timeout(
            lambda: player_ref.update(
                {
                    f"scores.{result.type}": validated_value,
                    result.type: validated_value,
                    "updated_at": now_iso,
                }
            ),
            timeout=10,
        )

        # Activate Live Entry mode for the event (locks custom drills)
        # Only update if not already active to save writes
        execute_with_timeout(
            lambda: event_ref.update({"live_entry_active": True}),
            timeout=5,
            operation_name="activate live entry",
        )

        logging.info(
            f"Drill result created for player {result.player_id}, type: {result.type}, value: {result.value}"
        )

        return {
            "id": doc_ref.id,
            "message": "Drill result created successfully",
            "drill_result": drill_result_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating drill result: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create drill result: {str(e)}"
        )


@router.put("/drill-results/{result_id}")
@write_rate_limit()
@require_permission(
    "drills",
    "update_result",
    target="event",
    target_param="event_id",
)
def update_drill_result(
    request: Request,
    result_id: str,
    payload: DrillResultUpdate,
    event_id: str = Query(..., regex=r"^.{1,50}$"),
    player_id: str = Query(..., regex=r"^.{1,50}$"),
    current_user=Depends(require_verified_user),
):
    try:
        enforce_event_league_relationship(event_id=event_id)
        check_write_permission(
            event_id=event_id,
            user_id=current_user["uid"],
            operation_name="update drill result",
        )

        player_ref = (
            db.collection("events")
            .document(event_id)
            .collection("players")
            .document(player_id)
        )
        result_ref = player_ref.collection("drill_results").document(result_id)

        result_doc = execute_with_timeout(lambda: result_ref.get(), timeout=5)
        if not result_doc.exists:
            raise HTTPException(status_code=404, detail="Drill result not found")

        result_data = result_doc.to_dict() or {}
        drill_type = result_data.get("type")
        if not drill_type:
            raise HTTPException(status_code=400, detail="Drill type missing on result")

        schema = get_event_schema(event_id)
        drill_def = next((d for d in schema.drills if d.key == drill_type), None)
        if not drill_def:
            raise HTTPException(status_code=400, detail=f"Unknown drill type: {drill_type}")

        min_val = drill_def.min_value if drill_def.min_value is not None else 0
        max_val = drill_def.max_value if drill_def.max_value is not None else 9999
        validated_value = float(payload.value)
        if validated_value < min_val or validated_value > max_val:
            raise HTTPException(
                status_code=400, detail=f"Value must be between {min_val} and {max_val}"
            )

        now_iso = datetime.utcnow().isoformat()
        update_data = {
            "value": validated_value,
            "updated_at": now_iso,
        }
        if payload.notes is not None:
            update_data["notes"] = payload.notes
        if payload.recorded_at is not None:
            update_data["recorded_at"] = payload.recorded_at

        execute_with_timeout(lambda: result_ref.update(update_data), timeout=5)

        # Ensure player.scores and legacy flat field reflect latest drill result.
        _sync_player_current_score(player_ref, drill_type)

        return {"message": "Drill result updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating drill result: {e}")
        raise HTTPException(status_code=500, detail="Failed to update drill result")


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
    current_user=Depends(require_verified_user),
):
    """
    Delete a specific drill result and revert the player's current score
    to the most recent previous entry (or remove it if none exist).
    """
    try:
        enforce_event_league_relationship(event_id=event_id)

        # Check scoped write permission (membership role is authoritative).
        check_write_permission(
            event_id=event_id,
            user_id=current_user["uid"],
            operation_name="delete drill result",
        )

        player_ref = (
            db.collection("events")
            .document(event_id)
            .collection("players")
            .document(player_id)
        )
        result_ref = player_ref.collection("drill_results").document(result_id)

        # Get the result to identify the drill type before deleting
        result_doc = execute_with_timeout(lambda: result_ref.get(), timeout=5)

        if not result_doc.exists:
            raise HTTPException(status_code=404, detail="Drill result not found")

        drill_type = result_doc.to_dict().get("type")

        # Delete the result
        execute_with_timeout(lambda: result_ref.delete(), timeout=5)

        _sync_player_current_score(player_ref, drill_type)

        return {"message": "Drill result deleted and score reverted"}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting drill result: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete drill result")
