from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db import SessionLocal
from backend.models import League, User, UserLeague, RoleEnum
from pydantic import BaseModel
from datetime import datetime
import random, string

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