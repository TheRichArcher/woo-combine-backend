from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import Event, UserLeague
from pydantic import BaseModel
from typing import List
from datetime import datetime
import traceback
import time
from fastapi.responses import JSONResponse
from backend.auth import get_current_user
import logging

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class EventCreate(BaseModel):
    name: str
    date: datetime
    league_id: str

class EventRead(BaseModel):
    id: int
    name: str
    date: datetime
    league_id: str
    class Config:
        from_attributes = True

@router.get("/events", response_model=List[EventRead])
def list_events(request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    from backend.routes.leagues import verify_user_in_league
    try:
        if 'user_id' in request.query_params:
            raise HTTPException(status_code=400, detail="Do not include user_id in query params. Use Authorization header.")
        user_leagues = db.query(UserLeague).filter_by(user_id=current_user.id).all()
        league_ids = [ul.league_id for ul in user_leagues]
        events = db.query(Event).filter(Event.league_id.in_(league_ids)).order_by(Event.date.desc()).all()
        return events
    except Exception as e:
        logging.error(f"Error in /events: {e}")
        raise HTTPException(status_code=503, detail=f"Internal error: {e}")

@router.post("/events", response_model=EventRead)
def create_event(event: EventCreate, user_id: str, db: Session = Depends(get_db)):
    from backend.routes.leagues import verify_user_in_league
    start_time = time.time()
    now_str = datetime.datetime.now().isoformat()
    print(f"[{now_str}] Received request to create event")
    print(f"[{now_str}] User ID: {user_id}")
    print(f"[{now_str}] League ID: {event.league_id}")
    print(f"[{now_str}] Request payload: {event.dict()}")
    try:
        if not verify_user_in_league(user_id, event.league_id, db):
            print(f"[{now_str}] User not in league, aborting")
            return JSONResponse(status_code=403, content={"error": "User not in league"})
        print(f"[{now_str}] Inserting event to database")
        db_event = Event(name=event.name, date=event.date, league_id=event.league_id)
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        print(f"[{now_str}] Event insert successful")
        duration = time.time() - start_time
        print(f"[{now_str}] Returning response")
        print(f"[{now_str}] Event creation completed in {duration:.2f}s")
        return db_event
    except Exception as e:
        print(f"[{now_str}] Event insert failed: {e}")
        print(traceback.format_exc())
        duration = time.time() - start_time
        print(f"[{now_str}] Returning error response after {duration:.2f}s")
        return JSONResponse(status_code=500, content={"error": "Internal server error", "details": str(e)}) 