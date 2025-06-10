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
        # PROPER SCALABLE SOLUTION: Use collection group query
        # This scales to millions of leagues with O(log n) complexity
        
        logging.info(f"🔍 Using collection group query to find memberships for user {user_id}")
        
        # Single query to find ALL user memberships across ALL leagues
        # This is how production apps handle this - one efficient query instead of N queries
        members_query = db.collection_group('members').where('__name__', '==', user_id)
        
        user_memberships = execute_with_timeout(
            lambda: list(members_query.stream()),
            timeout=10  # Single query with reasonable timeout
        )
        
        if not user_memberships:
            logging.warning(f"No memberships found for user {user_id}")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
        
        logging.info(f"🎯 Found {len(user_memberships)} memberships for user {user_id}")
        
        # Get league IDs from membership document paths
        league_ids = []
        membership_roles = {}
        
        for membership in user_memberships:
            # Extract league ID from document path: /leagues/{league_id}/members/{user_id}
            league_id = membership.reference.parent.parent.id
            member_data = membership.to_dict()
            role = member_data.get("role", "unknown")
            
            league_ids.append(league_id)
            membership_roles[league_id] = role
            
            logging.info(f"  ✅ Membership found in league {league_id} with role: {role}")
        
        # Batch get league details for all found memberships
        # Much more efficient than individual gets
        leagues = []
        if league_ids:
            logging.info(f"📦 Batch fetching details for {len(league_ids)} leagues")
            
            # Get league documents in batches (Firestore limit is 10 per batch)
            batch_size = 10
            for i in range(0, len(league_ids), batch_size):
                batch_ids = league_ids[i:i + batch_size]
                
                # Create document references for batch get
                league_refs = [db.collection("leagues").document(league_id) for league_id in batch_ids]
                
                # Batch get with timeout protection
                league_docs = execute_with_timeout(
                    lambda: db.get_all(league_refs),
                    timeout=5
                )
                
                # Process batch results
                for league_doc in league_docs:
                    if league_doc.exists:
                        league_data = league_doc.to_dict()
                        league_data["id"] = league_doc.id
                        league_data["role"] = membership_roles[league_doc.id]
                        leagues.append(league_data)
                        
                        logging.info(f"  📋 League details loaded: {league_data.get('name', 'Unknown')}")
        
        if not leagues:
            logging.warning(f"No valid leagues found for user {user_id}")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
            
        # Sort by creation date (newest first) for consistent ordering
        leagues.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        logging.info(f"🎉 Returning {len(leagues)} leagues for user {user_id} (scalable solution)")
        return {"leagues": leagues}
    
    try:
        # Wrap the entire operation in a 15-second timeout (scalable solution should be much faster)
        result = execute_with_timeout(_get_leagues_operation, timeout=15)
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