from fastapi import APIRouter, Depends, HTTPException, Request
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime
import logging
import concurrent.futures
from google.cloud.firestore import Query

router = APIRouter()

def execute_with_timeout(func, timeout=20, *args, **kwargs):
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
    
    def _get_leagues_operation():
        # Get leagues and check membership for each
        # This approach works well for moderate numbers of leagues
        
        logging.info(f"🔍 Finding leagues with membership for user {user_id}")
        
        # Get all leagues and check membership for each
        # Note: This approach works for moderate number of leagues (hundreds)
        # For thousands of leagues, would need a different architecture with user->leagues mapping
        
        logging.info(f"🔍 Fetching leagues to check membership for user {user_id}")
        
        # Get all leagues (limited to prevent timeouts)
        leagues_query = db.collection('leagues').order_by("created_at", direction=Query.DESCENDING).limit(50)
        
        all_leagues = execute_with_timeout(
            lambda: list(leagues_query.stream()),
            timeout=10
        )
        
        # Check membership in each league
        user_leagues = []
        
        for league_doc in all_leagues:
            league_id = league_doc.id
            
            # Check if user is a member of this league
            try:
                member_ref = db.collection('leagues').document(league_id).collection('members').document(user_id)
                member_doc = execute_with_timeout(
                    lambda: member_ref.get(),
                    timeout=2
                )
                
                if member_doc.exists:
                    # User is a member, get league data and role
                    league_data = league_doc.to_dict()
                    league_data["id"] = league_id
                    
                    member_data = member_doc.to_dict()
                    role = member_data.get("role", "unknown")
                    league_data["role"] = role
                    
                    user_leagues.append(league_data)
                    logging.info(f"  ✅ Membership found in league {league_id} ({league_data.get('name', 'Unknown')}) with role: {role}")
                    
            except Exception as e:
                logging.warning(f"Error checking membership in league {league_id}: {str(e)}")
                continue
        
        if not user_leagues:
            logging.warning(f"No memberships found for user {user_id}")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
            
        logging.info(f"🎯 Found {len(user_leagues)} leagues for user {user_id}")
        leagues = user_leagues
            
        # Sort by creation date (newest first) for consistent ordering
        leagues.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        logging.info(f"🎉 Returning {len(leagues)} leagues for user {user_id}")
        return {"leagues": leagues}
    
    try:
        # Wrap the entire operation in a 25-second timeout
        result = execute_with_timeout(_get_leagues_operation, timeout=25)
        return result
        
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
            timeout=20
        )
        
        # Add timeout protection to member creation with detailed logging
        try:
            member_ref = league_ref.collection("members").document(user_id)
            member_data = {
                "role": "organizer",
                "joined_at": datetime.utcnow().isoformat(),
                "email": current_user.get("email"),
                "name": current_user.get("name", "Unknown")
            }
            
            execute_with_timeout(
                lambda: member_ref.set(member_data),
                timeout=20
            )
            
            logging.info(f"✅ Member document created for user {user_id} in league {league_ref.id}")
            
            # Verify the membership was created successfully
            verify_member = execute_with_timeout(
                lambda: member_ref.get(),
                timeout=10
            )
            
            if verify_member.exists:
                logging.info(f"✅ Member document verified for user {user_id} in league {league_ref.id}")
            else:
                logging.error(f"❌ Member document verification FAILED for user {user_id} in league {league_ref.id}")
                raise HTTPException(status_code=500, detail="Failed to verify league membership creation")
                
        except Exception as e:
            logging.error(f"❌ Failed to create membership for user {user_id} in league {league_ref.id}: {str(e)}")
            # Clean up the league if membership creation fails
            try:
                league_ref.delete()
                logging.info(f"🧹 Cleaned up league {league_ref.id} due to membership creation failure")
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Failed to create league membership: {str(e)}")
        
        logging.info(f"🎉 League created with id {league_ref.id} by user {user_id} with verified membership")
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