from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import Event, UserLeague
from pydantic import BaseModel
from typing import List
from datetime import datetime

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
def list_events(user_id: str, db: Session = Depends(get_db)):
    from backend.routes.leagues import verify_user_in_league
    user_leagues = db.query(UserLeague).filter_by(user_id=user_id).all()
    league_ids = [ul.league_id for ul in user_leagues]
    events = db.query(Event).filter(Event.league_id.in_(league_ids)).order_by(Event.date.desc()).all()
    return events

@router.post("/events", response_model=EventRead)
def create_event(event: EventCreate, user_id: str, db: Session = Depends(get_db)):
    from backend.routes.leagues import verify_user_in_league
    if not verify_user_in_league(user_id, event.league_id, db):
        raise HTTPException(status_code=403, detail="User not in league")
    db_event = Event(name=event.name, date=event.date, league_id=event.league_id)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event 