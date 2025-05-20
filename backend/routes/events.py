from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import Event
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

class EventRead(BaseModel):
    id: int
    name: str
    date: datetime
    class Config:
        from_attributes = True

@router.get("/events", response_model=List[EventRead])
def list_events(db: Session = Depends(get_db)):
    events = db.query(Event).order_by(Event.date.desc()).all()
    return events

@router.post("/events", response_model=EventRead)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    db_event = Event(name=event.name, date=event.date)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event 