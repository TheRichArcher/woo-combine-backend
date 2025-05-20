from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import DrillResult
from typing import List
from pydantic import BaseModel

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

@router.post("/drill-results/", response_model=DrillResultCreate)
def create_drill_result(result: DrillResultCreate, db: Session = Depends(get_db)):
    # Validate drill type
    allowed_types = {"40m_dash", "vertical_jump", "catching", "throwing", "agility"}
    if result.type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid drill type.")
    db_result = DrillResult(
        player_id=result.player_id,
        type=result.type,
        value=result.value,
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return result

@router.get("/drill-results/{player_id}", response_model=List[DrillResultCreate])
def get_drill_results_by_player(player_id: int, db: Session = Depends(get_db)):
    results = db.query(DrillResult).filter(DrillResult.player_id == player_id).all()
    return [DrillResultCreate(player_id=r.player_id, type=r.type, value=r.value) for r in results]
