from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import DrillResult, DrillResultSchema, Event, UserLeague
from typing import List
from pydantic import BaseModel
from backend.routes.leagues import verify_user_in_league

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DrillResultCreate(BaseModel):
    player_id: int
    type: str
    value: float
    event_id: int

@router.post("/drill-results/", response_model=DrillResultSchema)
def create_drill_result(result: DrillResultCreate, user_id: str, db: Session = Depends(get_db)):
    # Validate drill type
    allowed_types = {"40m_dash", "vertical_jump", "catching", "throwing", "agility"}
    if result.type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid drill type.")
    event = db.query(Event).filter_by(id=result.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not verify_user_in_league(user_id, event.league_id, db):
        raise HTTPException(status_code=403, detail="User not in league")
    db_result = DrillResult(
        player_id=result.player_id,
        type=result.type,
        value=result.value,
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return DrillResultSchema.from_orm(db_result)

@router.get("/drill-results/", response_model=List[DrillResultSchema])
def get_all_drill_results(db: Session = Depends(get_db)):
    results = db.query(DrillResult).all()
    return [DrillResultSchema.from_orm(r) for r in results]

@router.get("/drill-results/{player_id}", response_model=List[DrillResultSchema])
def get_drill_results_by_player(player_id: int, db: Session = Depends(get_db)):
    results = db.query(DrillResult).filter(DrillResult.player_id == player_id).all()
    return [DrillResultSchema.from_orm(r) for r in results]
