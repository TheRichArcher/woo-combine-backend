from fastapi import APIRouter, Depends, HTTPException, Request
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime

router = APIRouter()

@router.get('/leagues/{league_id}/events')
def list_events(league_id: str, current_user=Depends(get_current_user)):
    events_ref = db.collection("leagues").document(league_id).collection("events")
    events = [dict(e.to_dict(), id=e.id) for e in events_ref.stream()]
    return {"events": events}

@router.post('/leagues/{league_id}/events')
def create_event(league_id: str, req: dict, current_user=Depends(get_current_user)):
    name = req.get("name")
    date = req.get("date")
    events_ref = db.collection("leagues").document(league_id).collection("events")
    event_ref = events_ref.document()
    event_ref.set({
        "name": name,
        "date": date,
        "created_at": datetime.utcnow().isoformat(),
    })
    return {"event_id": event_ref.id} 