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
def list_events(db: Session = Depends(get_db), current_user = Depends(get_current_user), request: Request = None):
    from backend.routes.leagues import verify_user_in_league
    now_str = datetime.datetime.now().isoformat()
    log_data = {"timestamp": now_str, "user_id": getattr(current_user, 'id', None), "path": str(request.url) if request else None}
    try:
        user_leagues = db.query(UserLeague).filter_by(user_id=current_user.id).all()
        league_ids = [ul.league_id for ul in user_leagues]
        events = db.query(Event).filter(Event.league_id.in_(league_ids)).order_by(Event.date.desc()).all()
        logging.info(f"[EVENTS LIST] {log_data} count={len(events)}")
        return events
    except Exception as e:
        logging.error(f"[EVENTS LIST ERROR] {str(e)} | {log_data}")
        raise HTTPException(status_code=503, detail=f"Internal error: {e}")

@router.post("/events", response_model=EventRead)
def create_event(event: EventCreate, user_id: str, db: Session = Depends(get_db), request: Request = None):
    from backend.routes.leagues import verify_user_in_league
    start_time = time.time()
    now_str = datetime.datetime.now().isoformat()
    log_data = {
        "timestamp": now_str,
        "user_id": user_id,
        "league_id": event.league_id,
        "event_payload": event.dict(),
        "path": str(request.url) if request else None
    }
    logging.info(f"[EVENT CREATE] {log_data}")
    try:
        if not verify_user_in_league(user_id, event.league_id, db):
            logging.warning(f"User {user_id} not in league {event.league_id}")
            raise HTTPException(status_code=403, detail="User not in league")
        db_event = Event(name=event.name, date=event.date, league_id=event.league_id)
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        duration = time.time() - start_time
        logging.info(f"[EVENT CREATED] user_id={user_id} league_id={event.league_id} event_id={db_event.id} duration={duration:.2f}s")
        return db_event
    except HTTPException as he:
        logging.error(f"[EVENT CREATE ERROR] {he.detail} | {log_data}")
        raise
    except Exception as e:
        duration = time.time() - start_time
        logging.error(f"[EVENT CREATE ERROR] {str(e)} | {log_data} | duration={duration:.2f}s")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 