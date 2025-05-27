from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import League, User, UserLeague, RoleEnum
from pydantic import BaseModel
from datetime import datetime
import random, string
from backend.auth import get_current_user
import logging

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
def create_league(req: LeagueCreateRequest, db: Session = Depends(get_db)):
    # Ensure user exists or create
    user = db.query(User).filter_by(id=req.user_id).first()
    if not user:
        user = User(id=req.user_id, email=req.email)
        db.add(user)
        db.commit()
    # Generate unique join code
    for _ in range(5):
        code = generate_join_code()
        if not db.query(League).filter_by(id=code).first():
            break
    else:
        raise HTTPException(status_code=500, detail='Could not generate unique join code')
    league = League(id=code, name=req.name, created_by_user_id=req.user_id)
    db.add(league)
    db.commit()
    # Add user as organizer
    user_league = UserLeague(user_id=req.user_id, league_id=code, role=RoleEnum.organizer)
    db.add(user_league)
    db.commit()
    return {"league_id": code, "join_code": code}

@router.post('/leagues/join/{code}')
def join_league(code: str, req: JoinLeagueRequest, db: Session = Depends(get_db)):
    league = db.query(League).filter_by(id=code).first()
    if not league:
        raise HTTPException(status_code=404, detail='League not found')
    # Ensure user exists or create
    user = db.query(User).filter_by(id=req.user_id).first()
    if not user:
        user = User(id=req.user_id, email=req.email)
        db.add(user)
        db.commit()
    # Check if already in league
    existing = db.query(UserLeague).filter_by(user_id=req.user_id, league_id=code).first()
    if existing:
        raise HTTPException(status_code=400, detail='User already in league')
    user_league = UserLeague(user_id=req.user_id, league_id=code, role=RoleEnum.coach)
    db.add(user_league)
    db.commit()
    return {"joined": True, "league_id": code, "league_name": league.name}

def verify_user_in_league(user_id: str, league_id: str, db: Session) -> bool:
    return db.query(UserLeague).filter_by(user_id=user_id, league_id=league_id).first() is not None

@router.get('/leagues')
def leagues_root():
    raise HTTPException(status_code=400, detail="Use /leagues/me to fetch user leagues.")

@router.get('/leagues/me')
def get_my_leagues(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        print("Headers:", request.headers)
        print("User:", current_user.id if current_user else "None")
        user_leagues = db.query(UserLeague).filter_by(user_id=current_user.id).all()
        leagues = []
        for ul in user_leagues:
            league = ul.league
            leagues.append({
                'id': league.id,
                'name': league.name,
                'season': getattr(league, 'season', None),
                'team_code': league.id,
                'created_by': getattr(league, 'created_by_user_id', None)
            })
        return {'leagues': leagues}
    except Exception as e:
        logging.error(f"Error in /leagues/me: {e}")
        raise HTTPException(status_code=503, detail=f"Internal error: {e}") 