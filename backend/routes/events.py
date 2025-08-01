from fastapi import APIRouter, Depends, HTTPException, Request, Path
from ..firestore_client import db
from ..auth import get_current_user, require_role
from datetime import datetime
import logging
from ..utils.database import execute_with_timeout

router = APIRouter()



@router.get('/leagues/{league_id}/events')
def list_events(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    current_user=Depends(get_current_user)
):
    try:
        events_ref = db.collection("leagues").document(league_id).collection("events")
        # Add timeout to events retrieval
        events_stream = execute_with_timeout(
            lambda: list(events_ref.stream()),
            timeout=10,
            operation_name="events retrieval"
        )
        events = [dict(e.to_dict(), id=e.id) for e in events_stream]
        logging.info(f"Found {len(events)} events for league {league_id}")
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
def get_event(
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

@router.put('/leagues/{league_id}/events/{event_id}')
def update_event(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$"), 
    req: dict = None, 
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        name = req.get("name")
        date = req.get("date")
        location = req.get("location")
        
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
        if req.get("drillTemplate"):
            # Validate drill template exists
            valid_templates = ["football", "soccer", "basketball", "baseball", "track", "volleyball"]
            if req["drillTemplate"] not in valid_templates:
                raise HTTPException(status_code=400, detail=f"Invalid drill template. Must be one of: {', '.join(valid_templates)}")
            update_data["drillTemplate"] = req["drillTemplate"]
        
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