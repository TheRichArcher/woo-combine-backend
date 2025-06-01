from fastapi import APIRouter, Depends, HTTPException, Request
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime

router = APIRouter()

@router.get('/leagues/me')
def get_my_leagues(current_user=Depends(get_current_user)):
    user_id = current_user["uid"]
    leagues_ref = db.collection("leagues")
    leagues = []
    for league in leagues_ref.stream():
        member_ref = league.reference.collection("members").document(user_id)
        member_doc = member_ref.get()
        if member_doc.exists:
            league_data = league.to_dict()
            league_data["id"] = league.id
            league_data["role"] = member_doc.to_dict().get("role")
            leagues.append(league_data)
    if not leagues:
        raise HTTPException(status_code=404, detail="No leagues found for this user.")
    return {"leagues": leagues}

@router.post('/leagues')
def create_league(req: dict, current_user=Depends(get_current_user)):
    user_id = current_user["uid"]
    name = req.get("name")
    league_ref = db.collection("leagues").document()
    league_ref.set({
        "name": name,
        "created_by_user_id": user_id,
        "created_at": datetime.utcnow().isoformat(),
    })
    league_ref.collection("members").document(user_id).set({
        "role": "organizer",
        "joined_at": datetime.utcnow().isoformat(),
    })
    return {"league_id": league_ref.id}

@router.post('/leagues/join/{code}')
def join_league(code: str, req: dict, current_user=Depends(get_current_user)):
    user_id = current_user["uid"]
    role = req.get("role", "coach")
    league_ref = db.collection("leagues").document(code)
    if not league_ref.get().exists:
        raise HTTPException(status_code=404, detail="League not found")
    member_ref = league_ref.collection("members").document(user_id)
    if member_ref.get().exists:
        raise HTTPException(status_code=400, detail="User already in league")
    member_ref.set({
        "role": role,
        "joined_at": datetime.utcnow().isoformat(),
    })
    return {"joined": True, "league_id": code}

@router.get('/leagues/{league_id}/teams')
def list_teams(league_id: str, current_user=Depends(get_current_user)):
    teams_ref = db.collection("leagues").document(league_id).collection("teams")
    teams = [dict(t.to_dict(), id=t.id) for t in teams_ref.stream()]
    return {"teams": teams}

@router.get('/leagues/{league_id}/invitations')
def list_invitations(league_id: str, current_user=Depends(get_current_user)):
    invitations_ref = db.collection("leagues").document(league_id).collection("invitations")
    invitations = [dict(i.to_dict(), id=i.id) for i in invitations_ref.stream()]
    return {"invitations": invitations} 