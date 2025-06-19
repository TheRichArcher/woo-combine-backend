from fastapi import APIRouter, Depends, HTTPException, Request, Path
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime
import concurrent.futures
import logging

router = APIRouter()

def execute_with_timeout(func, timeout=10, *args, **kwargs):
    """Execute a function with timeout protection"""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            logging.error(f"Operation timed out after {timeout} seconds: {func.__name__}")
            raise HTTPException(
                status_code=504,
                detail=f"Database operation timed out after {timeout} seconds"
            )

@router.get('/leagues/{league_id}/events')
def list_events(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    current_user=Depends(get_current_user)
):
    logging.info(f"[DEBUG] list_events called with league_id: '{league_id}' (length: {len(league_id)})")
    try:
        events_ref = db.collection("leagues").document(league_id).collection("events")
        # Add timeout to events retrieval
        events_stream = execute_with_timeout(
            lambda: list(events_ref.stream()),
            timeout=10
        )
        events = [dict(e.to_dict(), id=e.id) for e in events_stream]
        logging.info(f"[DEBUG] Found {len(events)} events for league {league_id}")
        return {"events": events}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing events for league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list events")

@router.post('/leagues/{league_id}/events')
def create_event(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: dict = None, 
    current_user=Depends(get_current_user)
):
    logging.info(f"[DEBUG] create_event called with league_id: '{league_id}' (length: {len(league_id)})")
    try:
        name = req.get("name")
        date = req.get("date")
        location = req.get("location")
        
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
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Store event in league subcollection
        execute_with_timeout(
            lambda: event_ref.set(event_data),
            timeout=10
        )
        
        # ALSO store event in top-level events collection (for players endpoints)
        top_level_event_ref = db.collection("events").document(event_ref.id)
        execute_with_timeout(
            lambda: top_level_event_ref.set(event_data),
            timeout=10
        )
        
        logging.info(f"[DEBUG] Created event {event_ref.id} in league {league_id}")
        return {"event_id": event_ref.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating event in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create event")

@router.get('/leagues/{league_id}/events/{event_id}')
def get_event(
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    logging.info(f"[DEBUG] get_event called with league_id: '{league_id}', event_id: '{event_id}'")
    try:
        # Try to get event from league subcollection first
        league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: league_event_ref.get(),
            timeout=10
        )
        
        if event_doc.exists:
            event_data = event_doc.to_dict()
            event_data["id"] = event_doc.id
            logging.info(f"[DEBUG] Found event {event_id} in league {league_id}")
            return event_data
        
        # If not found in league subcollection, try top-level events collection
        top_level_event_ref = db.collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: top_level_event_ref.get(),
            timeout=10
        )
        
        if event_doc.exists:
            event_data = event_doc.to_dict()
            event_data["id"] = event_doc.id
            # Verify it belongs to the requested league
            if event_data.get("league_id") == league_id:
                logging.info(f"[DEBUG] Found event {event_id} in top-level collection for league {league_id}")
                return event_data
        
        logging.warning(f"[DEBUG] Event {event_id} not found in league {league_id}")
        raise HTTPException(status_code=404, detail="Event not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching event {event_id} from league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch event")

@router.put('/leagues/{league_id}/events/{event_id}')
def update_event(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: dict = None, 
    current_user=Depends(get_current_user)
):
    logging.info(f"[DEBUG] update_event called with league_id: '{league_id}', event_id: '{event_id}'")
    try:
        name = req.get("name")
        date = req.get("date")
        location = req.get("location")
        
        if not name:
            raise HTTPException(status_code=400, detail="Event name is required")
        
        # Prepare update data
        update_data = {
            "name": name,
            "date": date,
            "location": location or "",
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Update event in league subcollection
        league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
        execute_with_timeout(
            lambda: league_event_ref.update(update_data),
            timeout=10
        )
        
        # Also update in top-level events collection
        top_level_event_ref = db.collection("events").document(event_id)
        execute_with_timeout(
            lambda: top_level_event_ref.update(update_data),
            timeout=10
        )
        
        logging.info(f"[DEBUG] Updated event {event_id} in league {league_id}")
        return {"message": "Event updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating event {event_id} in league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update event") 