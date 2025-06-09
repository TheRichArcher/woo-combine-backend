from fastapi import APIRouter, Depends, HTTPException, Request
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime
import logging
import concurrent.futures

router = APIRouter()

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

@router.get('/leagues/me')
def get_my_leagues(current_user=Depends(get_current_user)):
    logging.info(f"[GET] /leagues/me called by user: {current_user}")
    user_id = current_user["uid"]
    
    try:
        leagues_ref = db.collection("leagues")
        leagues = []
        
        # Simple approach: get first 50 leagues and check membership
        all_leagues = list(leagues_ref.limit(50).stream())
        
        if not all_leagues:
            logging.warning(f"No leagues exist in system")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
        
        for league in all_leagues:
            try:
                member_ref = league.reference.collection("members").document(user_id)
                member_doc = member_ref.get()
                if member_doc.exists:
                    league_data = league.to_dict()
                    league_data["id"] = league.id
                    league_data["role"] = member_doc.to_dict().get("role")
                    leagues.append(league_data)
            except Exception as e:
                logging.warning(f"Error checking membership for league {league.id}: {e}")
                continue
                
        if not leagues:
            logging.warning(f"No leagues found for user {user_id}")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
            
        logging.info(f"Returning {len(leagues)} leagues for user {user_id}")
        return {"leagues": leagues}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in get_my_leagues: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve leagues")

@router.post('/leagues')
def create_league(req: dict, current_user=Depends(get_current_user)):
    logging.info(f"[POST] /leagues called by user: {current_user} with req: {req}")
    user_id = current_user["uid"]
    name = req.get("name")
    
    if not name:
        raise HTTPException(status_code=400, detail="League name is required")
    
    try:
        league_ref = db.collection("leagues").document()
        
        # Add timeout protection to league creation
        execute_with_timeout(
            lambda: league_ref.set({
                "name": name,
                "created_by_user_id": user_id,
                "created_at": datetime.utcnow().isoformat(),
            }),
            timeout=10
        )
        
        # Add timeout protection to member creation
        execute_with_timeout(
            lambda: league_ref.collection("members").document(user_id).set({
                "role": "organizer",
                "joined_at": datetime.utcnow().isoformat(),
            }),
            timeout=10
        )
        
        logging.info(f"League created with id {league_ref.id} by user {user_id}")
        return {"league_id": league_ref.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create league")

@router.post('/leagues/join/{code}')
def join_league(code: str, req: dict, current_user=Depends(get_current_user)):
    logging.info(f"[POST] /leagues/join/{code} called by user: {current_user} with req: {req}")
    user_id = current_user["uid"]
    role = req.get("role", "coach")
    
    try:
        league_ref = db.collection("leagues").document(code)
        
        # Simple league existence check
        league_doc = league_ref.get()
        if not league_doc.exists:
            logging.warning(f"League not found: {code}")
            raise HTTPException(status_code=404, detail="League not found")
        
        member_ref = league_ref.collection("members").document(user_id)
        
        # Simple member existence check
        existing_member = member_ref.get()
        if existing_member.exists:
            logging.warning(f"User {user_id} already in league {code}")
            raise HTTPException(status_code=400, detail="User already in league")
        
        # Simple member creation
        member_ref.set({
            "role": role,
            "joined_at": datetime.utcnow().isoformat(),
        })
        
        logging.info(f"User {user_id} joined league {code} as {role}")
        return {"joined": True, "league_id": code}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to join league")

@router.get('/leagues/{league_id}/teams')
def list_teams(league_id: str, current_user=Depends(get_current_user)):
    try:
        teams_ref = db.collection("leagues").document(league_id).collection("teams")
        teams_stream = list(teams_ref.stream())
        teams = [dict(t.to_dict(), id=t.id) for t in teams_stream]
        return {"teams": teams}
    except Exception as e:
        logging.error(f"Error retrieving teams: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve teams")

@router.get('/leagues/{league_id}/invitations')
def list_invitations(league_id: str, current_user=Depends(get_current_user)):
    try:
        invitations_ref = db.collection("leagues").document(league_id).collection("invitations")
        invitations_stream = list(invitations_ref.stream())
        invitations = [dict(i.to_dict(), id=i.id) for i in invitations_stream]
        return {"invitations": invitations}
    except Exception as e:
        logging.error(f"Error retrieving invitations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invitations") 