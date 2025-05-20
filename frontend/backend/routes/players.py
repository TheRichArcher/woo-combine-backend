from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import Player, PlayerSchema, DrillResult
from typing import List, Dict, Any
from pydantic import BaseModel
from uuid import UUID

router = APIRouter()

# Utility: Composite Score Calculation
DRILL_WEIGHTS = {
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
}

def calculate_composite_score(player: Player, session: Session) -> float:
    results = session.query(DrillResult).filter(DrillResult.player_id == player.id).all()
    drill_map = {r.type: r.value for r in results}
    score = 0.0
    for drill, weight in DRILL_WEIGHTS.items():
        value = drill_map.get(drill, 0)
        score += value * weight
    return score

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/players", response_model=List[PlayerSchema])
def get_players(event_id: UUID = Query(...), db: Session = Depends(get_db)):
    players = db.query(Player).filter(Player.event_id == event_id).all()
    result = []
    for player in players:
        composite_score = calculate_composite_score(player, db)
        player_dict = PlayerSchema.from_orm(player).dict()
        player_dict["composite_score"] = composite_score
        result.append(player_dict)
    return result

from pydantic import BaseModel
class PlayerCreate(BaseModel):
    name: str
    number: int
    age_group: str
    photo_url: str | None = None

@router.post("/players", response_model=PlayerSchema)
def create_player(player: PlayerCreate, db: Session = Depends(get_db)):
    db_player = Player(
        name=player.name,
        number=player.number,
        age_group=player.age_group,
        photo_url=player.photo_url,
    )
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player

class UploadRequest(BaseModel):
    event_id: UUID
    players: List[Dict[str, Any]]

@router.post("/players/upload")
def upload_players(req: UploadRequest, db: Session = Depends(get_db)):
    event_id = req.event_id
    players = req.players
    required_fields = ["name", "number", "age_group"]
    drill_fields = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
    errors = []
    added = 0
    for idx, player in enumerate(players):
        row_errors = []
        for field in required_fields:
            if not player.get(field):
                row_errors.append(f"Missing {field}")
        try:
            number = int(player.get("number", ""))
        except Exception:
            row_errors.append("Invalid number")
        if player.get("age_group") not in ["7-8", "9-10", "11-12"]:
            row_errors.append("Invalid age_group")
        for drill in drill_fields:
            val = player.get(drill, "")
            if val != "" and val is not None:
                try:
                    float(val)
                except Exception:
                    row_errors.append(f"Invalid {drill}")
        if row_errors:
            errors.append({"row": idx + 1, "message": ", ".join(row_errors)})
            continue
        db_player = Player(
            name=player["name"],
            number=int(player["number"]),
            age_group=player["age_group"],
            photo_url=None,
            event_id=event_id,
        )
        db.add(db_player)
        db.commit()
        db.refresh(db_player)
        for drill in drill_fields:
            val = player.get(drill, "")
            if val != "" and val is not None:
                db_result = DrillResult(
                    player_id=db_player.id,
                    type=drill,
                    value=float(val),
                    event_id=event_id,
                )
                db.add(db_result)
        db.commit()
        added += 1
    return {"added": added, "errors": errors}

@router.delete("/players/reset")
def reset_players(event_id: UUID = Query(...), db: Session = Depends(get_db)):
    # Delete all drill results for the event
    db.query(DrillResult).filter(DrillResult.event_id == event_id).delete()
    db.query(Player).filter(Player.event_id == event_id).delete()
    db.commit()
    return {"status": "reset", "event_id": str(event_id)}
