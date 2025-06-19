from fastapi import APIRouter, Depends, HTTPException, Request
from backend.firestore_client import db
from backend.auth import get_current_user
from datetime import datetime
import logging
import concurrent.futures
from google.cloud.firestore import Query

# Fixed: Removed FieldPath import to resolve deployment issues

router = APIRouter()

def execute_with_timeout(func, timeout=10, *args, **kwargs):
    """Execute a function with timeout protection - OPTIMIZED for extreme cold starts"""
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
        # FAST PATH: Direct user membership lookup (O(1) operation)
        logging.info(f"🚀 Checking user_memberships for user {user_id}")
        
        user_memberships_ref = db.collection('user_memberships').document(user_id)
        user_doc = execute_with_timeout(
            user_memberships_ref.get,
            timeout=5  # Increased timeout for extreme cold starts
        )
        
        if user_doc.exists and user_doc.to_dict().get('leagues'):
            # NEW SYSTEM: Fast lookup path
            membership_data = user_doc.to_dict()
            league_memberships = membership_data.get('leagues', {})
            
            if league_memberships:
                # Batch get all league details in parallel
                league_ids = list(league_memberships.keys())
                logging.info(f"📊 Batch fetching {len(league_ids)} leagues for user {user_id}")
                
                # Use batch get for maximum efficiency with longer timeout
                league_refs = [db.collection('leagues').document(league_id) for league_id in league_ids]
                league_docs = execute_with_timeout(
                    lambda: db.get_all(league_refs),
                    timeout=10  # Increased timeout for batch operation during extreme cold starts
                )
                
                user_leagues = []
                for league_doc in league_docs:
                    if league_doc.exists:
                        league_data = league_doc.to_dict()
                        league_data["id"] = league_doc.id
                        
                        # Get role from membership data
                        membership_info = league_memberships.get(league_doc.id, {})
                        role = membership_info.get("role", "unknown")
                        league_data["role"] = role
                        
                        user_leagues.append(league_data)
                        logging.info(f"  ✅ League {league_doc.id} ({league_data.get('name', 'Unknown')}) with role: {role}")
                
                if user_leagues:
                    # Sort by creation date (newest first)
                    user_leagues.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                    logging.info(f"🚀 Fast path: returned {len(user_leagues)} leagues for user {user_id}")
                    return {"leagues": user_leagues}
        
        # LEGACY PATH: Only if new system has no data - OPTIMIZED for extreme cold starts
        logging.info(f"🔄 No user_memberships found, checking legacy system for user {user_id}")
        
        # Reduced limit for faster cold start response and increased timeout
        leagues_query = db.collection('leagues').order_by("created_at", direction=Query.DESCENDING).limit(5)  # Reduced from 10 to 5
        all_leagues = execute_with_timeout(
            lambda: list(leagues_query.stream()),
            timeout=10  # Increased timeout for extreme cold starts
        )
        
        # Check membership in each league (old way) with longer timeouts
        user_leagues = []
        migration_data = {}
        
        for league_doc in all_leagues:
            league_id = league_doc.id
            
            try:
                member_ref = db.collection('leagues').document(league_id).collection('members').document(user_id)
                member_doc = execute_with_timeout(
                    lambda: member_ref.get(),
                    timeout=5  # Increased timeout for extreme cold starts
                )
                
                if member_doc.exists:
                    # Found membership - prepare for migration
                    league_data = league_doc.to_dict()
                    league_data["id"] = league_id
                    
                    member_data = member_doc.to_dict()
                    role = member_data.get("role", "unknown")
                    league_data["role"] = role
                    
                    user_leagues.append(league_data)
                    
                    # Prepare migration data
                    migration_data[league_id] = {
                        "role": role,
                        "joined_at": member_data.get("joined_at", datetime.utcnow().isoformat()),
                        "league_name": league_data.get("name", "Unknown League")
                    }
                    
                    logging.info(f"  🔄 Found legacy membership: {league_id} ({league_data.get('name', 'Unknown')}) with role: {role}")
                    
            except Exception as e:
                logging.warning(f"Error checking legacy membership in league {league_id}: {str(e)}")
                continue
        
        if not user_leagues:
            logging.warning(f"No leagues found for user {user_id} in either system")
            raise HTTPException(status_code=404, detail="No leagues found for this user.")
        
        # MIGRATE: Create user_memberships document for future speed (async to not block response)
        if migration_data:
            try:
                migration_doc = {"leagues": migration_data}
                execute_with_timeout(
                    lambda: user_memberships_ref.set(migration_doc),
                    timeout=5  # Reasonable timeout for migration
                )
                logging.info(f"✅ Migrated {len(migration_data)} leagues to new system for user {user_id}")
            except Exception as e:
                logging.error(f"⚠️ Migration failed (non-critical): {str(e)}")
        
        # Sort and return legacy data
        user_leagues.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        logging.info(f"🎉 Legacy path: returned {len(user_leagues)} leagues for user {user_id}")
        return {"leagues": user_leagues}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in get_my_leagues: {str(e)}")
        # More specific error messages for debugging
        if "timeout" in str(e).lower():
            raise HTTPException(status_code=504, detail="Database operation timed out during server startup. Please try again.")
        else:
            raise HTTPException(status_code=500, detail="Failed to retrieve leagues due to server initialization")

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
            timeout=10  # Reduced from 20s
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
                timeout=10  # Reduced from 20s
            )
            
            logging.info(f"✅ Member document created for user {user_id} in league {league_ref.id}")
            
            # CRITICAL: Add to user_memberships for instant lookup (like MojoSport)
            try:
                user_memberships_ref = db.collection('user_memberships').document(user_id)
                membership_update = {
                    f"leagues.{league_ref.id}": {
                        "role": "organizer",
                        "joined_at": datetime.utcnow().isoformat(),
                        "league_name": name
                    }
                }
                
                execute_with_timeout(
                    lambda: user_memberships_ref.set(membership_update, merge=True),
                    timeout=5  # Reduced from 10s
                )
                logging.info(f"✅ Updated user_memberships for instant lookup: {user_id} -> {league_ref.id}")
                
            except Exception as e:
                logging.error(f"⚠️ Failed to update user_memberships (non-critical): {str(e)}")
                # Don't fail the whole operation for this
                
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
    # ENHANCED DEBUGGING for pattern validation issues
    logging.info(f"[POST] /leagues/join/{code} called by user: {current_user} with req: {req}")
    logging.info(f"[DEBUG] Received code parameter: '{code}' (type: {type(code)}, length: {len(code)})")
    logging.info(f"[DEBUG] Code characters: {[c for c in code]}")
    logging.info(f"[DEBUG] ASCII values: {[ord(c) for c in code]}")
    
    user_id = current_user["uid"]
    role = req.get("role", "coach")
    
    try:
        logging.info(f"[DEBUG] Attempting to find league document with ID: {code}")
        league_ref = db.collection("leagues").document(code)
        
        # Simple league existence check
        league_doc = league_ref.get()
        if not league_doc.exists:
            logging.warning(f"[DEBUG] League document does not exist for ID: {code}")
            logging.warning(f"[DEBUG] This might be an event ID instead of a league ID")
            raise HTTPException(status_code=404, detail="League not found")
        
        logging.info(f"[DEBUG] League document found successfully for ID: {code}")
        member_ref = league_ref.collection("members").document(user_id)
        
        # Simple member existence check
        existing_member = member_ref.get()
        if existing_member.exists:
            logging.warning(f"User {user_id} already in league {code}")
            raise HTTPException(status_code=400, detail="User already in league")
        
        # Simple member creation
        join_time = datetime.utcnow().isoformat()
        member_ref.set({
            "role": role,
            "joined_at": join_time,
        })
        
        # CRITICAL: Add to user_memberships for instant lookup (like MojoSport)
        try:
            league_data = league_doc.to_dict()
            user_memberships_ref = db.collection('user_memberships').document(user_id)
            membership_update = {
                f"leagues.{code}": {
                    "role": role,
                    "joined_at": join_time,
                    "league_name": league_data.get("name", "Unknown League")
                }
            }
            
            execute_with_timeout(
                lambda: user_memberships_ref.set(membership_update, merge=True),
                timeout=5  # Reduced from 10s
            )
            logging.info(f"✅ Updated user_memberships for instant lookup: {user_id} -> {code}")
            
        except Exception as e:
            logging.error(f"⚠️ Failed to update user_memberships (non-critical): {str(e)}")
            # Don't fail the whole operation for this
        
        logging.info(f"User {user_id} joined league {code} as {role}")
        return {"joined": True, "league_id": code}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining league: {str(e)}")
        logging.error(f"[DEBUG] Full error details: {type(e).__name__}: {str(e)}")
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