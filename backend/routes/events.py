from fastapi import APIRouter, Depends, HTTPException, Request, Path, Query
from typing import Optional
from ..firestore_client import db
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit
from datetime import datetime
import logging
from ..utils.database import execute_with_timeout
from pydantic import BaseModel
from typing import Dict

router = APIRouter()



@router.get('/leagues/{league_id}/events')
@read_rate_limit()
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
        # Firestore stream returns all docs; optionally constrain with ordering and limit for faster responses
        events_query = events_ref.order_by("created_at", direction=Query.DESCENDING).limit(200) if 'Query' in globals() else events_ref
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

@router.post('/leagues/{league_id}/events')
@write_rate_limit()
def create_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: EventCreateRequest | None = None, 
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        name = req.name if req else None
        date = req.date if req else None
        location = req.location if req else None
        
        if not name:
            raise HTTPException(status_code=400, detail="Event name is required")
        
        # Create event in league subcollection (for league-specific queries)
        events_ref = db.collection("leagues").document(league_id).collection("events")
        event_ref = events_ref.document()
        
        event_data = {
            "name": name,
            "date": date,
            "location": location or "",
            "league_id": league_id,  # Add league_id reference
            "drillTemplate": "football",  # Default to football template
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Store event in league subcollection
        execute_with_timeout(
            lambda: event_ref.set(event_data),
            timeout=10,
            operation_name="event creation in league"
        )
        
        # ALSO store event in top-level events collection (for players endpoints)
        top_level_event_ref = db.collection("events").document(event_ref.id)
        execute_with_timeout(
            lambda: top_level_event_ref.set(event_data),
            timeout=10,
            operation_name="event creation in global collection"
        )
        
        logging.info(f"Created event {event_ref.id} in league {league_id}")
        return {"event_id": event_ref.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating event in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create event")

@router.get('/leagues/{league_id}/events/{event_id}')
@read_rate_limit()
def get_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    try:
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
    drillTemplate: str | None = None

@router.put('/leagues/{league_id}/events/{event_id}')
@write_rate_limit()
def update_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: EventUpdateRequest | None = None, 
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        name = req.name if req else None
        date = req.date if req else None
        location = req.location if req else None
        
        if not name:
            raise HTTPException(status_code=400, detail="Event name is required")
        
        # Prepare update data with validation
        update_data = {
            "name": name,
            "date": date,
            "location": location or "",
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Add drillTemplate if provided and valid
        if req and req.drillTemplate:
            # Validate drill template exists
            valid_templates = ["football", "soccer", "basketball", "baseball", "track", "volleyball"]
            if req.drillTemplate not in valid_templates:
                raise HTTPException(status_code=400, detail=f"Invalid drill template. Must be one of: {', '.join(valid_templates)}")
            update_data["drillTemplate"] = req.drillTemplate
        
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
def delete_event(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    current_user=Depends(require_role("organizer"))
):
    """Delete an event and all associated data (requires organizer role)"""
    try:
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