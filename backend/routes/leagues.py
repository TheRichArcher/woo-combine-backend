from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import League, User, UserLeague, RoleEnum
from pydantic import BaseModel
from datetime import datetime
import random, string, logging

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_join_code(length=7):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

class LeagueCreateRequest(BaseModel):
    name: str
    user_id: str  # Firebase UID
    email: str

class JoinLeagueRequest(BaseModel):
    user_id: str  # Firebase UID
    email: str

@router.post('/leagues')
def create_league(req: LeagueCreateRequest, db: Session = Depends(get_db), request: Request = None):
    now_str = datetime.now().isoformat()
    log_data = {"timestamp": now_str, "user_id": req.user_id, "path": str(request.url) if request else None}
    try:
        user = db.query(User).filter_by(id=req.user_id).first()
        if not user:
            user = User(id=req.user_id, email=req.email)
            db.add(user)
            db.commit()
        for _ in range(5):
            code = generate_join_code()
            if not db.query(League).filter_by(id=code).first():
                break
        else:
            logging.error(f"[LEAGUE CREATE ERROR] Could not generate unique join code | {log_data}")
            raise HTTPException(status_code=500, detail='Could not generate unique join code')
        league = League(id=code, name=req.name, created_by_user_id=req.user_id)
        db.add(league)
        db.commit()
        user_league = UserLeague(user_id=req.user_id, league_id=code, role=RoleEnum.organizer)
        db.add(user_league)
        db.commit()
        logging.info(f"[LEAGUE CREATED] {log_data} league_id={code}")
        return {"league_id": code, "join_code": code}
    except HTTPException as he:
        logging.error(f"[LEAGUE CREATE ERROR] {he.detail} | {log_data}")
        raise
    except Exception as e:
        logging.error(f"[LEAGUE CREATE ERROR] {str(e)} | {log_data}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post('/leagues/join/{code}')
def join_league(code: str, req: JoinLeagueRequest, db: Session = Depends(get_db), request: Request = None):
    now_str = datetime.now().isoformat()
    log_data = {"timestamp": now_str, "user_id": req.user_id, "league_id": code, "path": str(request.url) if request else None}
    try:
        league = db.query(League).filter_by(id=code).first()
        if not league:
            logging.warning(f"[LEAGUE JOIN ERROR] League not found | {log_data}")
            raise HTTPException(status_code=404, detail='League not found')
        user = db.query(User).filter_by(id=req.user_id).first()
        if not user:
            user = User(id=req.user_id, email=req.email)
            db.add(user)
            db.commit()
        existing = db.query(UserLeague).filter_by(user_id=req.user_id, league_id=code).first()
        if existing:
            logging.warning(f"[LEAGUE JOIN ERROR] User already in league | {log_data}")
            raise HTTPException(status_code=400, detail='User already in league')
        user_league = UserLeague(user_id=req.user_id, league_id=code, role=RoleEnum.coach)
        db.add(user_league)
        db.commit()
        logging.info(f"[LEAGUE JOINED] {log_data}")
        return {"joined": True, "league_id": code, "league_name": league.name}
    except HTTPException as he:
        logging.error(f"[LEAGUE JOIN ERROR] {he.detail} | {log_data}")
        raise
    except Exception as e:
        logging.error(f"[LEAGUE JOIN ERROR] {str(e)} | {log_data}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def verify_user_in_league(user_id: str, league_id: str, db: Session) -> bool:
    return db.query(UserLeague).filter_by(user_id=user_id, league_id=league_id).first() is not None

@router.get('/leagues/me')
def get_my_leagues(user_id: str, db: Session = Depends(get_db), request: Request = None):
    now_str = datetime.now().isoformat()
    log_data = {"timestamp": now_str, "user_id": user_id, "path": str(request.url) if request else None}
    try:
        logging.info(f"[LEAGUES ME] {log_data}")
        user_leagues = db.query(UserLeague).filter_by(user_id=user_id).all()
        leagues = []
        for ul in user_leagues:
            league = ul.league
            leagues.append({
                'id': league.id,
                'name': league.name,
                'season': getattr(league, 'season', None),
                'team_code': league.id
            })
        if not leagues:
            logging.warning(f"[LEAGUES ME ERROR] No leagues found | {log_data}")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
        return {'leagues': leagues}
    except HTTPException as he:
        logging.error(f"[LEAGUES ME ERROR] {he.detail} | {log_data}")
        raise
    except Exception as e:
        logging.error(f"[LEAGUES ME ERROR] {str(e)} | {log_data}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 