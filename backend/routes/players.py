from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any
from pydantic import BaseModel
from uuid import UUID
from backend.auth import get_current_user, require_role
import logging
from backend.firestore_client import db
from datetime import datetime
from backend.models import PlayerSchema
import concurrent.futures

router = APIRouter()

# Utility: Composite Score Calculation
DRILL_WEIGHTS = {
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
}

# def calculate_composite_score(player: Player, session: Session, weights: dict = None) -> float:
#     results = session.query(DrillResult).filter(DrillResult.player_id == player.id).all()
#     drill_map = {r.type: r.value for r in results}
#     score = 0.0
#     use_weights = weights if weights is not None else DRILL_WEIGHTS
#     for drill, weight in use_weights.items():
#         value = drill_map.get(drill, 0)
#         score += value * weight
#     return score

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

def execute_with_timeout(func, timeout=10, *args, **kwargs):
    """Execute a function with timeout protection"""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            logging.error(f"Operation timed out after {timeout} seconds: {func.__name__}")
            raise HTTPException(
                status_code=504,
                detail=f"Database operation timed out after {timeout} seconds"
            )

@router.get("/players", response_model=List[PlayerSchema])
def get_players(request: Request, event_id: UUID = Query(...), current_user = Depends(get_current_user)):
    try:
        if 'user_id' in request.query_params:
            raise HTTPException(status_code=400, detail="Do not include user_id in query params. Use Authorization header.")
        
        # Add timeout to event lookup
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=5
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
            
        # Add timeout to players retrieval
        players_stream = execute_with_timeout(
            lambda: list(db.collection("events").document(str(event_id)).collection("players").stream()),
            timeout=15
        )
        
        result = []
        for player in players_stream:
            # TODO: Implement Firestore-based composite score calculation if needed
            player_dict = player.to_dict()
            player_dict["id"] = player.id
            result.append(player_dict)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in /players: {e}")
        raise HTTPException(status_code=503, detail=f"Internal error: {e}")

from pydantic import BaseModel
class PlayerCreate(BaseModel):
    name: str
    number: int | None = None
    age_group: str | None = None
    photo_url: str | None = None

@router.post("/players", response_model=PlayerSchema)
def create_player(player: PlayerCreate, current_user=Depends(get_current_user)):
    try:
        player_doc = db.collection("players").document()
        
        # Add timeout to player creation
        execute_with_timeout(
            lambda: player_doc.set({
                "name": player.name,
                "number": player.number,
                "age_group": player.age_group,
                "photo_url": player.photo_url,
                "created_at": datetime.utcnow().isoformat(),
            }),
            timeout=10
        )
        return {"player_id": player_doc.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating player: {e}")
        raise HTTPException(status_code=500, detail="Failed to create player")

class UploadRequest(BaseModel):
    event_id: UUID
    players: List[Dict[str, Any]]

@router.post("/players/upload")
def upload_players(req: UploadRequest, current_user=Depends(require_role("organizer"))):
    try:
        # Add timeout to event lookup
        event = execute_with_timeout(
            db.collection("events").document(str(req.event_id)).get,
            timeout=5
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
            
        event_id = req.event_id
        players = req.players
        required_fields = ["name"]
        drill_fields = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        errors = []
        added = 0
        
        for idx, player in enumerate(players):
            row_errors = []
            for field in required_fields:
                if not player.get(field):
                    row_errors.append(f"Missing {field}")
            if player.get("number") not in (None, ""):
                try:
                    int(player.get("number"))
                except Exception:
                    row_errors.append("Invalid number")
            if player.get("age_group") not in (None, ""):
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
                
            player_doc = db.collection("players").document()
            
            # Prepare player data with drill scores
            player_data = {
                "name": player["name"],
                "number": int(player["number"]) if player.get("number") not in (None, "") else None,
                "age_group": player["age_group"] if player.get("age_group") not in (None, "") else None,
                "photo_url": None,
                "event_id": event_id,
                "created_at": datetime.utcnow().isoformat(),
            }
            
            # Add drill scores if provided
            for drill in drill_fields:
                value = player.get(drill, "")
                if value and value.strip() != "":
                    try:
                        player_data[drill] = float(value)
                    except ValueError:
                        # This shouldn't happen due to validation, but just in case
                        player_data[drill] = None
                else:
                    player_data[drill] = None
            
            # Add timeout to player creation
            execute_with_timeout(
                lambda: player_doc.set(player_data),
                timeout=10
            )
            added += 1
            
        return {"added": added, "errors": errors}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading players: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload players")

@router.delete("/players/reset")
def reset_players(event_id: UUID = Query(...), current_user=Depends(require_role("organizer"))):
    drill_results_ref = db.collection("events").document(str(event_id)).collection("drill_results")
    drill_results_ref.delete()
    players_ref = db.collection("events").document(str(event_id)).collection("players")
    players_ref.delete()
    return {"status": "reset", "event_id": str(event_id)}

@router.get("/rankings")
def get_rankings(
    age_group: str = Query(...),
    weight_40m_dash: float = Query(None, alias="weight_40m_dash"),
    weight_vertical_jump: float = Query(None, alias="weight_vertical_jump"),
    weight_catching: float = Query(None, alias="weight_catching"),
    weight_throwing: float = Query(None, alias="weight_throwing"),
    weight_agility: float = Query(None, alias="weight_agility"),
):
    try:
        # Parse weights if all are provided
        custom_weights = None
        weight_params = [weight_40m_dash, weight_vertical_jump, weight_catching, weight_throwing, weight_agility]
        drill_keys = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        if all(w is not None for w in weight_params):
            if not all(isinstance(w, float) and 0 <= w <= 1 for w in weight_params):
                raise HTTPException(status_code=400, detail="All weights must be numbers between 0 and 1.")
            total = sum(weight_params)
            if abs(total - 1.0) > 1e-6:
                raise HTTPException(status_code=400, detail="Weights must sum to 1.0.")
            custom_weights = dict(zip(drill_keys, weight_params))
        elif any(w is not None for w in weight_params):
            raise HTTPException(status_code=400, detail="Either provide all weights or none.")
            
        # Add timeout to players query
        players_stream = execute_with_timeout(
            lambda: list(db.collection("players").where("age_group", "==", age_group).stream()),
            timeout=15
        )
        
        ranked = []
        for player in players_stream:
            # TODO: Implement Firestore-based composite score calculation if needed
            ranked.append({
                "player_id": player.id,
                "name": player.get("name"),
                "number": player.get("number"),
                # Add composite_score if needed
            })
        ranked.sort(key=lambda x: x.get("composite_score", 0), reverse=True)
        for idx, player in enumerate(ranked, start=1):
            player["rank"] = idx
        return ranked
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting rankings: {e}")
        raise HTTPException(status_code=500, detail="Failed to get rankings")

@router.post("/players/bulk")
def bulk_upload_players(user=Depends(require_role("organizer"))):
    raise NotImplementedError("Bulk upload endpoint not yet implemented.")

@router.post("/rankings/weights")
def set_custom_weights(user=Depends(require_role("coach", "organizer"))):
    raise NotImplementedError("Custom weights endpoint not yet implemented.")

@router.get("/admin")
def admin_dashboard(user=Depends(require_role("organizer"))):
    raise NotImplementedError("Admin dashboard endpoint not yet implemented.")

@router.get('/leagues/{league_id}/players')
def list_players(league_id: str, current_user=Depends(get_current_user)):
    try:
        players_ref = db.collection("leagues").document(league_id).collection("players")
        # Add timeout to players retrieval
        players_stream = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=10
        )
        players = [dict(p.to_dict(), id=p.id) for p in players_stream]
        return {"players": players}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing players: {e}")
        raise HTTPException(status_code=500, detail="Failed to list players")

@router.post('/leagues/{league_id}/players')
def add_player(league_id: str, req: dict, current_user=Depends(get_current_user)):
    try:
        players_ref = db.collection("leagues").document(league_id).collection("players")
        player_doc = players_ref.document()
        
        # Add timeout to player creation
        execute_with_timeout(
            lambda: player_doc.set({
                **req,
                "created_at": datetime.utcnow().isoformat(),
            }),
            timeout=10
        )
        return {"player_id": player_doc.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding player: {e}")
        raise HTTPException(status_code=500, detail="Failed to add player")

@router.get('/leagues/{league_id}/players/{player_id}/drill_results')
def list_drill_results(league_id: str, player_id: str, current_user=Depends(get_current_user)):
    try:
        drill_results_ref = db.collection("leagues").document(league_id).collection("players").document(player_id).collection("drill_results")
        # Add timeout to drill results retrieval
        results_stream = execute_with_timeout(
            lambda: list(drill_results_ref.stream()),
            timeout=10
        )
        results = [dict(r.to_dict(), id=r.id) for r in results_stream]
        return {"drill_results": results}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing drill results: {e}")
        raise HTTPException(status_code=500, detail="Failed to list drill results")
