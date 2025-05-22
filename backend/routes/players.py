from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import Player, PlayerSchema, DrillResult, Event, UserLeague
from typing import List, Dict, Any
from pydantic import BaseModel
from uuid import UUID
from backend.routes.leagues import verify_user_in_league

router = APIRouter()

# Utility: Composite Score Calculation
DRILL_WEIGHTS = {
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
}

def calculate_composite_score(player: Player, session: Session, weights: dict = None) -> float:
    results = session.query(DrillResult).filter(DrillResult.player_id == player.id).all()
    drill_map = {r.type: r.value for r in results}
    score = 0.0
    use_weights = weights if weights is not None else DRILL_WEIGHTS
    for drill, weight in use_weights.items():
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
def get_players(event_id: UUID = Query(...), user_id: str = Query(...), db: Session = Depends(get_db)):
    event = db.query(Event).filter_by(id=event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not verify_user_in_league(user_id, event.league_id, db):
        raise HTTPException(status_code=403, detail="User not in league")
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
def upload_players(req: UploadRequest, user_id: str = Query(...), db: Session = Depends(get_db)):
    event = db.query(Event).filter_by(id=req.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not verify_user_in_league(user_id, event.league_id, db):
        raise HTTPException(status_code=403, detail="User not in league")
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

@router.get("/rankings")
def get_rankings(
    age_group: str = Query(...),
    weight_40m_dash: float = Query(None, alias="weight_40m_dash"),
    weight_vertical_jump: float = Query(None, alias="weight_vertical_jump"),
    weight_catching: float = Query(None, alias="weight_catching"),
    weight_throwing: float = Query(None, alias="weight_throwing"),
    weight_agility: float = Query(None, alias="weight_agility"),
    db: Session = Depends(get_db),
):
    # Parse weights if all are provided
    custom_weights = None
    weight_params = [weight_40m_dash, weight_vertical_jump, weight_catching, weight_throwing, weight_agility]
    drill_keys = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
    if all(w is not None for w in weight_params):
        # Validate all are numbers between 0 and 1
        if not all(isinstance(w, float) and 0 <= w <= 1 for w in weight_params):
            raise HTTPException(status_code=400, detail="All weights must be numbers between 0 and 1.")
        total = sum(weight_params)
        if abs(total - 1.0) > 1e-6:
            raise HTTPException(status_code=400, detail="Weights must sum to 1.0.")
        custom_weights = dict(zip(drill_keys, weight_params))
    elif any(w is not None for w in weight_params):
        raise HTTPException(status_code=400, detail="Either provide all weights or none.")

    players = db.query(Player).filter(Player.age_group == age_group).all()
    ranked = []
    for player in players:
        composite_score = calculate_composite_score(player, db, custom_weights)
        ranked.append({
            "player_id": player.id,
            "name": player.name,
            "number": player.number,
            "composite_score": composite_score
        })
    # Sort by composite_score descending
    ranked.sort(key=lambda x: x["composite_score"], reverse=True)
    # Assign rank (1-based, no ties/skips)
    for idx, player in enumerate(ranked, start=1):
        player["rank"] = idx
    return ranked
