from fastapi import APIRouter, Depends, HTTPException, Request, Path, Query
from google.cloud import firestore
from typing import Optional, List
from ..firestore_client import db
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit
from datetime import datetime
import logging
from ..utils.database import execute_with_timeout
from ..utils.data_integrity import (
    ensure_league_document,
    enforce_event_league_relationship,
)
from ..security.access_matrix import require_permission
from pydantic import BaseModel
from typing import Dict
from ..models import (
    CustomDrillCreateRequest,
    CustomDrillUpdateRequest,
    CustomDrillSchema
)
from ..utils.event_schema import get_event_schema

router = APIRouter()



@router.get('/leagues/{league_id}/events')
@read_rate_limit()
@require_permission("events", "list", target="league", target_param="league_id")
def list_events(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
    current_user=Depends(get_current_user)
):
    try:
        events_ref = db.collection("leagues").document(league_id).collection("events")
        # Add timeout to events retrieval and cap to reduce large payloads
        # Order newest first; use Firestore's Query constants explicitly to avoid FastAPI's Query name clash
        events_query = events_ref.order_by("created_at", direction=firestore.Query.DESCENDING).limit(200)
        events_stream = execute_with_timeout(
            lambda: list(events_query.stream()),
            timeout=10,
            operation_name="events retrieval"
        )
        events_list = [dict(e.to_dict(), id=e.id) for e in events_stream]
        # Optional in-memory pagination (non-breaking; only applies when provided)
        if page is not None and limit is not None:
            start = (page - 1) * limit
            end = start + limit
            events = events_list[start:end]
        else:
            events = events_list
        logging.info(f"Found {len(events)} events for league {league_id}")
        return {"events": events}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing events for league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list events")

class EventCreateRequest(BaseModel):
    name: str
    date: str | None = None
    location: str | None = None
    notes: str | None = None
    drillTemplate: str | None = "football"
    disabledDrills: List[str] = []

@router.post('/leagues/{league_id}/events')
@write_rate_limit()
@require_permission("events", "create", target="league", target_param="league_id")
def create_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: EventCreateRequest | None = None, 
    current_user=Depends(require_role("organizer"))
):
    try:
        name = req.name if req else None
        date = req.date if req else None
        location = req.location if req else None
        notes = req.notes if req else None
        drill_template = req.drillTemplate if req and req.drillTemplate else "football"
        disabled_drills = req.disabledDrills if req else []
        
        logging.info(f"Event creation request - Name: {name}, Template: {drill_template}, Disabled: {disabled_drills}")

        if not name:
            raise HTTPException(status_code=400, detail="Event name is required")

        # DUPLICATE PROTECTION: Check if event with same name and date already exists in this league
        # This prevents accidental double-submissions from frontend
        existing_query = (
            db.collection("leagues").document(league_id).collection("events")
            .where("name", "==", name)
            .where("date", "==", date)
            .limit(1)
        )
        
        existing_events = execute_with_timeout(
            lambda: list(existing_query.stream()),
            timeout=5,
            operation_name="check duplicate event"
        )
        
        if len(existing_events) > 0:
            logging.warning(f"Duplicate event creation attempted: {name} on {date} in league {league_id}")
            # Return the existing event ID instead of creating a new one (idempotency)
            # or raise error. Returning existing ID is safer for "double click" scenarios.
            return {"event_id": existing_events[0].id, "message": "Event already exists"}

        # Validate drill template exists
        valid_templates = ["football", "soccer", "basketball", "baseball", "track", "volleyball"]
        if drill_template not in valid_templates:
            logging.warning(f"Invalid drill template '{drill_template}' requested. Defaulting to 'football'.")
            drill_template = "football"

        ensure_league_document(league_id)
        # Create event in league subcollection (for league-specific queries)
        events_ref = db.collection("leagues").document(league_id).collection("events")
        event_ref = events_ref.document()
        
        event_data = {
            "name": name,
            "date": date,
            "location": location or "",
            "notes": notes or "",
            "league_id": league_id,  # Add league_id reference
            "drillTemplate": drill_template,
            "disabled_drills": disabled_drills,
            "created_at": datetime.utcnow().isoformat(),
            "live_entry_active": False,
        }
        
        # ATOMIC BATCH WRITE for consistency
        batch = db.batch()
        
        # Store event in league subcollection
        batch.set(event_ref, event_data)
        
        # ALSO store event in top-level events collection (for players endpoints)
        top_level_event_ref = db.collection("events").document(event_ref.id)
        batch.set(top_level_event_ref, event_data)
        
        execute_with_timeout(
            lambda: batch.commit(),
            timeout=10,
            operation_name="atomic event creation"
        )
        
        logging.info(f"Created event {event_ref.id} in league {league_id}")
        # Return complete event object to prevent frontend data inconsistency
        return {
            "event_id": event_ref.id,
            "event": {
                **event_data,
                "id": event_ref.id
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating event in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create event")

@router.get('/leagues/{league_id}/events/{event_id}')
@read_rate_limit()
@require_permission("events", "read", target="league", target_param="league_id")
def get_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    try:
        enforce_event_league_relationship(
            event_id=event_id,
            expected_league_id=league_id,
        )
        # Try to get event from league subcollection first
        league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: league_event_ref.get(),
            timeout=10,
            operation_name="event retrieval from league"
        )
        
        if event_doc.exists:
            event_data = event_doc.to_dict()
            event_data["id"] = event_doc.id
            logging.info(f"Found event {event_id} in league {league_id}")
            return event_data
        
        # If not found in league subcollection, try top-level events collection
        top_level_event_ref = db.collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: top_level_event_ref.get(),
            timeout=10,
            operation_name="event retrieval from global collection"
        )
        
        if event_doc.exists:
            event_data = event_doc.to_dict()
            event_data["id"] = event_doc.id
            # Verify it belongs to the requested league
            if event_data.get("league_id") == league_id:
                logging.info(f"Found event {event_id} in top-level collection for league {league_id}")
                return event_data
        
        logging.warning(f"Event {event_id} not found in league {league_id}")
        raise HTTPException(status_code=404, detail="Event not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching event {event_id} from league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch event")

class EventUpdateRequest(BaseModel):
    name: str
    date: str | None = None
    location: str | None = None
    notes: str | None = None
    drillTemplate: str | None = None
    live_entry_active: bool | None = None
    disabledDrills: List[str] | None = None

@router.put('/leagues/{league_id}/events/{event_id}')
@write_rate_limit()
@require_permission("events", "update", target="league", target_param="league_id")
def update_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: EventUpdateRequest | None = None, 
    current_user=Depends(require_role("organizer"))
):
    try:
        name = req.name if req else None
        date = req.date if req else None
        location = req.location if req else None
        notes = req.notes if req else None
        
        if not name:
            raise HTTPException(status_code=400, detail="Event name is required")

        enforce_event_league_relationship(
            event_id=event_id,
            expected_league_id=league_id,
        )
        # Prepare update data with validation
        update_data = {
            "name": name,
            "date": date,
            "location": location or "",
            "notes": notes or "",
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Add drillTemplate if provided and valid
        if req and req.drillTemplate:
            # Validate drill template exists
            valid_templates = ["football", "soccer", "basketball", "baseball", "track", "volleyball"]
            if req.drillTemplate not in valid_templates:
                raise HTTPException(status_code=400, detail=f"Invalid drill template. Must be one of: {', '.join(valid_templates)}")
            update_data["drillTemplate"] = req.drillTemplate
        
        # Add live_entry_active if provided
        if req and req.live_entry_active is not None:
            update_data["live_entry_active"] = req.live_entry_active

        # Add disabledDrills if provided
        if req and req.disabledDrills is not None:
            update_data["disabled_drills"] = req.disabledDrills

        # Update event in league subcollection
        league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
        execute_with_timeout(
            lambda: league_event_ref.update(update_data),
            timeout=10,
            operation_name="event update in league"
        )
        
        # Also update in top-level events collection
        top_level_event_ref = db.collection("events").document(event_id)
        execute_with_timeout(
            lambda: top_level_event_ref.update(update_data),
            timeout=10,
            operation_name="event update in global collection"
        )
        
        logging.info(f"Updated event {event_id} in league {league_id}")
        return {"message": "Event updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating event {event_id} in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update event")

@router.delete('/leagues/{league_id}/events/{event_id}')
@write_rate_limit()
@require_permission("events", "delete", target="league", target_param="league_id")
def delete_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    current_user=Depends(require_role("organizer"))
):
    """Delete an event and all associated data (requires organizer role)"""
    try:
        enforce_event_league_relationship(
            event_id=event_id,
            expected_league_id=league_id,
        )
        # Verify event exists and belongs to league
        league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: league_event_ref.get(),
            timeout=10,
            operation_name="event verification for deletion"
        )
        
        if not event_doc.exists:
            # Try top-level collection
            top_level_event_ref = db.collection("events").document(event_id)
            event_doc = execute_with_timeout(
                lambda: top_level_event_ref.get(),
                timeout=10,
                operation_name="event verification in global collection"
            )
            
            if not event_doc.exists or event_doc.to_dict().get("league_id") != league_id:
                raise HTTPException(status_code=404, detail="Event not found")
        
        # Delete event data in sequence to avoid orphaned data
        # 1. Delete all players associated with this event (correct subcollection path)
        players_ref = db.collection("events").document(event_id).collection("players")
        players_docs = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=15,
            operation_name="players cleanup for event deletion"
        )
        
        # Delete players in batches with better error handling
        deleted_players_count = 0
        batch = db.batch()
        try:
            for i, player_doc in enumerate(players_docs):
                batch.delete(player_doc.reference)
                # Commit batch every 400 operations (Firestore limit is 500)
                if (i + 1) % 400 == 0:
                    execute_with_timeout(
                        lambda: batch.commit(),
                        timeout=10,
                        operation_name="players batch deletion"
                    )
                    deleted_players_count += 400
                    batch = db.batch()
            
            # Commit remaining players
            remaining_count = len(players_docs) % 400
            if remaining_count > 0:
                execute_with_timeout(
                    lambda: batch.commit(),
                    timeout=10,
                    operation_name="final players batch deletion"
                )
                deleted_players_count += remaining_count
        except Exception as e:
            logging.error(f"Error during player deletion: {e}")
            # Continue with other deletions but track what failed
            deleted_players_count = max(0, deleted_players_count)
        
        # 2. Delete evaluators subcollection
        evaluators_ref = db.collection("events").document(event_id).collection("evaluators")
        evaluators_docs = execute_with_timeout(
            lambda: list(evaluators_ref.stream()),
            timeout=10,
            operation_name="evaluators cleanup for event deletion"
        )
        
        deleted_evaluators_count = 0
        for evaluator_doc in evaluators_docs:
            try:
                execute_with_timeout(
                    lambda: evaluator_doc.reference.delete(),
                    timeout=5,
                    operation_name="evaluator deletion"
                )
                deleted_evaluators_count += 1
            except Exception as e:
                logging.error(f"Error deleting evaluator {evaluator_doc.id}: {e}")
                continue
        
        # 3. Delete drill evaluations subcollection
        drill_evaluations_ref = db.collection("events").document(event_id).collection("drill_evaluations")
        drill_evaluations_docs = execute_with_timeout(
            lambda: list(drill_evaluations_ref.stream()),
            timeout=10,
            operation_name="drill evaluations cleanup for event deletion"
        )
        
        deleted_evaluations_count = 0
        for eval_doc in drill_evaluations_docs:
            try:
                execute_with_timeout(
                    lambda: eval_doc.reference.delete(),
                    timeout=5,
                    operation_name="drill evaluation deletion"
                )
                deleted_evaluations_count += 1
            except Exception as e:
                logging.error(f"Error deleting drill evaluation {eval_doc.id}: {e}")
                continue
        
        # 4. Delete aggregated drill results subcollection
        aggregated_results_ref = db.collection("events").document(event_id).collection("aggregated_drill_results")
        aggregated_docs = execute_with_timeout(
            lambda: list(aggregated_results_ref.stream()),
            timeout=10,
            operation_name="aggregated results cleanup for event deletion"
        )
        
        deleted_aggregated_count = 0
        for agg_doc in aggregated_docs:
            try:
                execute_with_timeout(
                    lambda: agg_doc.reference.delete(),
                    timeout=5,
                    operation_name="aggregated result deletion"
                )
                deleted_aggregated_count += 1
            except Exception as e:
                logging.error(f"Error deleting aggregated result {agg_doc.id}: {e}")
                continue
        
        # 5. Delete from league subcollection
        execute_with_timeout(
            lambda: league_event_ref.delete(),
            timeout=10,
            operation_name="event deletion from league"
        )
        
        # 6. Delete from top-level events collection
        top_level_event_ref = db.collection("events").document(event_id)
        execute_with_timeout(
            lambda: top_level_event_ref.delete(),
            timeout=10,
            operation_name="event deletion from global collection"
        )
        
        logging.info(f"Successfully deleted event {event_id} and associated data from league {league_id}")
        return {
            "message": "Event deleted successfully",
            "deleted_players": deleted_players_count,
            "deleted_evaluators": deleted_evaluators_count,
            "deleted_evaluations": deleted_evaluations_count,
            "deleted_aggregated_results": deleted_aggregated_count,
            "total_found": {
                "players": len(players_docs),
                "evaluators": len(evaluators_docs),
                "evaluations": len(drill_evaluations_docs),
                "aggregated_results": len(aggregated_docs)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting event {event_id} from league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete event")


# --- Custom Drill Endpoints ---

def check_event_unlocked(event_id: str):
    """Helper to ensure event is not locked (Live Entry active)"""
    event_ref = db.collection("events").document(event_id)
    event_doc = execute_with_timeout(
        lambda: event_ref.get(),
        timeout=5,
        operation_name="check event lock status"
    )
    
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if event_doc.to_dict().get("live_entry_active", False):
        raise HTTPException(status_code=409, detail="Cannot modify drills after Live Entry has started")

@router.post('/leagues/{league_id}/events/{event_id}/custom-drills')
@write_rate_limit()
@require_permission("events", "update", target="league", target_param="league_id")
def create_custom_drill(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    req: CustomDrillCreateRequest = None,
    current_user=Depends(require_role("organizer"))
):
    try:
        enforce_event_league_relationship(event_id=event_id, expected_league_id=league_id)
        check_event_unlocked(event_id)
        
        if req.min_val >= req.max_val:
            raise HTTPException(status_code=400, detail="Minimum value must be less than maximum value")
            
        # Check for name uniqueness (case-insensitive)
        drills_ref = db.collection("events").document(event_id).collection("custom_drills")
        existing_drills = execute_with_timeout(
            lambda: list(drills_ref.stream()),
            timeout=10
        )
        
        for d in existing_drills:
            if d.to_dict().get("name", "").lower() == req.name.lower():
                raise HTTPException(status_code=400, detail="A drill with this name already exists in this event")
        
        new_drill_ref = drills_ref.document()
        drill_data = req.dict()
        drill_data.update({
            "id": new_drill_ref.id,
            "event_id": event_id,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": current_user["uid"]
        })
        
        execute_with_timeout(
            lambda: new_drill_ref.set(drill_data),
            timeout=10,
            operation_name="create custom drill"
        )
        
        logging.info(f"Created custom drill {new_drill_ref.id} for event {event_id}")
        return drill_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating custom drill for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create custom drill")

@router.get('/leagues/{league_id}/events/{event_id}/custom-drills')
@read_rate_limit()
@require_permission("events", "read", target="league", target_param="league_id")
def list_custom_drills(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    try:
        enforce_event_league_relationship(event_id=event_id, expected_league_id=league_id)
        
        # Get lock status
        event_ref = db.collection("events").document(event_id)
        event_doc = execute_with_timeout(lambda: event_ref.get(), timeout=5)
        is_locked = False
        if event_doc.exists:
            is_locked = event_doc.to_dict().get("live_entry_active", False)
            
        drills_ref = db.collection("events").document(event_id).collection("custom_drills")
        drills_stream = execute_with_timeout(
            lambda: list(drills_ref.order_by("created_at").stream()),
            timeout=10,
            operation_name="list custom drills"
        )
        
        drills = []
        for d in drills_stream:
            data = d.to_dict()
            data["id"] = d.id
            data["is_locked"] = is_locked
            drills.append(data)
            
        return {"custom_drills": drills}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing custom drills for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list custom drills")

@router.put('/leagues/{league_id}/events/{event_id}/custom-drills/{drill_id}')
@write_rate_limit()
@require_permission("events", "update", target="league", target_param="league_id")
def update_custom_drill(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    drill_id: str = Path(..., regex=r"^.{1,50}$"),
    req: CustomDrillUpdateRequest = None,
    current_user=Depends(require_role("organizer"))
):
    try:
        enforce_event_league_relationship(event_id=event_id, expected_league_id=league_id)
        check_event_unlocked(event_id)
        
        drill_ref = db.collection("events").document(event_id).collection("custom_drills").document(drill_id)
        drill_doc = execute_with_timeout(lambda: drill_ref.get(), timeout=5)
        
        if not drill_doc.exists:
            raise HTTPException(status_code=404, detail="Drill not found")
            
        update_data = req.dict(exclude_unset=True)
        if not update_data:
            return drill_doc.to_dict()
            
        # Validate min/max if both present
        current_data = drill_doc.to_dict()
        new_min = update_data.get("min_val", current_data.get("min_val"))
        new_max = update_data.get("max_val", current_data.get("max_val"))
        
        if new_min >= new_max:
             raise HTTPException(status_code=400, detail="Minimum value must be less than maximum value")
             
        execute_with_timeout(
            lambda: drill_ref.update(update_data),
            timeout=10,
            operation_name="update custom drill"
        )
        
        updated_doc = execute_with_timeout(lambda: drill_ref.get(), timeout=5)
        return updated_doc.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating custom drill {drill_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update custom drill")

@router.delete('/leagues/{league_id}/events/{event_id}/custom-drills/{drill_id}')
@write_rate_limit()
@require_permission("events", "update", target="league", target_param="league_id")
def delete_custom_drill(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    drill_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(require_role("organizer"))
):
    try:
        enforce_event_league_relationship(event_id=event_id, expected_league_id=league_id)
        check_event_unlocked(event_id)
        
        drill_ref = db.collection("events").document(event_id).collection("custom_drills").document(drill_id)
        
        # Check existence first
        drill_doc = execute_with_timeout(lambda: drill_ref.get(), timeout=5)
        if not drill_doc.exists:
            raise HTTPException(status_code=404, detail="Drill not found")

        # CRITICAL DATA INTEGRITY: Check if any scores exist for this drill
        # We check the 'players' collection because create_drill_result denormalizes 
        # the score onto the player document using the drill ID as the field key.
        # This allows us to use a simple subcollection query (supported by default indexes)
        # rather than a complex Collection Group Query.
        scores_query = (
            db.collection("events").document(event_id).collection("players")
            .where(drill_id, ">", float("-inf")) # Checks if field exists and has a value
            .limit(1)
        )
        
        existing_scores = execute_with_timeout(
            lambda: list(scores_query.stream()), 
            timeout=8,
            operation_name="check existing scores"
        )
        
        if len(existing_scores) > 0:
            logging.warning(f"Attempted to delete custom drill {drill_id} (event {event_id}) which has existing scores. Blocked.")
            raise HTTPException(
                status_code=409, 
                detail="Cannot delete this drill because player scores have already been recorded for it. Please clear the scores first or use Reset Event."
            )

        execute_with_timeout(
            lambda: drill_ref.delete(),
            timeout=10,
            operation_name="delete custom drill"
        )
        
        logging.info(f"Deleted custom drill {drill_id} from event {event_id}")
        return Response(status_code=204)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting custom drill {drill_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete custom drill")

@router.get('/leagues/{league_id}/events/{event_id}/schema')
@read_rate_limit()
@require_permission("events", "read", target="league", target_param="league_id")
def get_league_event_schema_endpoint(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    """
    Get the drill schema for a specific league event.
    Prefer this endpoint over /events/{id}/schema as it reliably finds events in subcollections.
    """
    try:
        enforce_event_league_relationship(event_id=event_id, expected_league_id=league_id)

        # Pass league_id to find event in subcollection
        schema = get_event_schema(event_id, league_id=league_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Event schema not found")

        # LOGGING: Custom drill count and keys for debugging import issues
        custom_drills = [d for d in schema.drills if d.category == "custom" or len(d.key) >= 20] 
        logging.warning(f"[SCHEMA_DEBUG] League Schema response for {event_id}: {len(schema.drills)} total drills ({len(custom_drills)} custom). Custom keys: {[d.key for d in custom_drills]}")

        return {
            "id": schema.id,
            "name": schema.name,
            "sport": schema.sport,
            "drills": [
                {
                    "key": drill.key,
                    "label": drill.label,
                    "unit": drill.unit,
                    "min_value": drill.min_value,
                    "max_value": drill.max_value,
                    "default_weight": drill.default_weight,
                    "lower_is_better": drill.lower_is_better,
                    "category": drill.category,
                    "description": drill.description
                }
                for drill in schema.drills
            ],
            "presets": [
                {
                    "id": preset.id,
                    "name": preset.name,
                    "description": preset.description,
                    "weights": preset.weights
                }
                for preset in schema.presets
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting event schema for {event_id} in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get event schema")

@router.get('/events/{event_id}/schema')
@read_rate_limit()
@require_permission("events", "read", target="event", target_param="event_id")
def get_event_schema_endpoint(
    request: Request,
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    """
    Get the drill schema for an event, including all available drills.
    Used by frontend for CSV import field mapping.
    """
    try:
        enforce_event_league_relationship(event_id=event_id)

        schema = get_event_schema(event_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Event schema not found")

        # LOGGING: Custom drill count and keys for debugging import issues
        custom_drills = [d for d in schema.drills if d.category == "custom" or len(d.key) >= 20] 
        logging.warning(f"[SCHEMA_DEBUG] Global Schema response for {event_id}: {len(schema.drills)} total drills ({len(custom_drills)} custom). Custom keys: {[d.key for d in custom_drills]}")

        return {
            "id": schema.id,
            "name": schema.name,
            "sport": schema.sport,
            "drills": [
                {
                    "key": drill.key,
                    "label": drill.label,
                    "unit": drill.unit,
                    "min_value": drill.min_value,
                    "max_value": drill.max_value,
                    "default_weight": drill.default_weight,
                    "lower_is_better": drill.lower_is_better,
                    "category": drill.category,
                    "description": drill.description
                }
                for drill in schema.drills
            ],
            "presets": [
                {
                    "id": preset.id,
                    "name": preset.name,
                    "description": preset.description,
                    "weights": preset.weights
                }
                for preset in schema.presets
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting event schema for {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get event schema")
