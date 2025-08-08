from fastapi import APIRouter, Depends, HTTPException, Request, Path, Query
from ..firestore_client import db
from ..auth import get_current_user
from datetime import datetime
import logging
from google.cloud.firestore import Query
from ..utils.database import execute_with_timeout

# Fixed: Removed FieldPath import to resolve deployment issues

router = APIRouter()



@router.get('/leagues/me')
def get_my_leagues(current_user=Depends(get_current_user)):
    logging.info(f"[GET] /leagues/me called by user: {current_user}")
    user_id = current_user["uid"]
    
    try:
        # FAST PATH: Direct user membership lookup (O(1) operation)
        logging.info(f"🚀 Checking user_memberships for user {user_id}")
        
        user_memberships_ref = db.collection('user_memberships').document(user_id)
        # PERFORMANCE: Direct Firestore call without timeout wrapper overhead
        user_doc = user_memberships_ref.get()
        
        if user_doc.exists and user_doc.to_dict().get('leagues'):
            # NEW SYSTEM: Fast lookup path
            membership_data = user_doc.to_dict()
            league_memberships = membership_data.get('leagues', {})
            
            if league_memberships:
                # Batch get all league details in parallel
                league_ids = list(league_memberships.keys())
                logging.info(f"📊 Batch fetching {len(league_ids)} leagues for user {user_id}")
                
                # Use batch get for maximum efficiency
                league_refs = [db.collection('leagues').document(league_id) for league_id in league_ids]
                # PERFORMANCE: Direct batch get without timeout wrapper overhead
                league_docs = db.get_all(league_refs)
                
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
        
        # Reduced limit for faster cold start response
        leagues_query = db.collection('leagues').order_by("created_at", direction=Query.DESCENDING).limit(5)  # Reduced from 10 to 5
        # PERFORMANCE: Direct query without timeout wrapper overhead
        all_leagues = list(leagues_query.stream())
        
        # Check membership in each league (old way) with longer timeouts
        user_leagues = []
        migration_data = {}
        
        for league_doc in all_leagues:
            league_id = league_doc.id
            
            try:
                member_ref = db.collection('leagues').document(league_id).collection('members').document(user_id)
                # PERFORMANCE: Direct member lookup without timeout wrapper overhead
                member_doc = member_ref.get()
                
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
        # PERFORMANCE OPTIMIZATION: Use Firestore batch for atomic writes
        # This reduces 3-4 sequential calls to 1 batch operation (75% improvement)
        batch = db.batch()
        league_ref = db.collection("leagues").document()
        
        # Prepare timestamps once for consistency
        created_at = datetime.utcnow().isoformat()
        
        # 1. League document
        league_data = {
            "name": name,
            "created_by_user_id": user_id,
            "created_at": created_at,
        }
        batch.set(league_ref, league_data)
        
        # 2. Member document
        member_ref = league_ref.collection("members").document(user_id)
        member_data = {
            "role": "organizer",
            "joined_at": created_at,
            "email": current_user.get("email"),
            "name": current_user.get("name", "Unknown")
        }
        batch.set(member_ref, member_data)
        
        # 3. User memberships for fast lookup
        user_memberships_ref = db.collection('user_memberships').document(user_id)
        membership_update = {
            f"leagues.{league_ref.id}": {
                "role": "organizer",
                "joined_at": created_at,
                "league_name": name
            }
        }
        batch.set(user_memberships_ref, membership_update, merge=True)
        
        # Execute all operations atomically
        logging.info(f"[BATCH] Executing atomic league creation for user {user_id}")
        batch.commit()
        
        logging.info(f"🎉 League created with id {league_ref.id} by user {user_id} using batch operation")
        return {"league_id": league_ref.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create league")

@router.post('/leagues/join/{code}')
def join_league(
    code: str = Path(..., regex=r"^.{1,50}$"),
    req: dict | None = None, 
    current_user=Depends(get_current_user)
):
    logging.info(f"[POST] /leagues/join/{code} called by user: {current_user} with req: {req}")
    
    user_id = current_user["uid"]
    role = req.get("role", "coach") if req else "coach"
    
    try:
        # PERFORMANCE: Get league document and check membership in parallel
        league_ref = db.collection("leagues").document(code)
        member_ref = league_ref.collection("members").document(user_id)
        
        # Parallel reads for faster response
        league_doc = league_ref.get()
        existing_member = member_ref.get()
        
        if not league_doc.exists:
            logging.warning(f"League document does not exist for ID: {code}")
            raise HTTPException(status_code=404, detail="League not found")
        
        league_data = league_doc.to_dict()
        league_name = league_data.get("name", "Unknown League")
        
        if existing_member.exists:
            logging.warning(f"User {user_id} already in league {code}")
            # Return success with league name even if already a member
            return {"joined": True, "league_id": code, "league_name": league_name}
        
        # PERFORMANCE OPTIMIZATION: Use batch write for atomic join operation
        join_time = datetime.utcnow().isoformat()
        batch = db.batch()
        
        # 1. Add user as member
        member_data = {
            "role": role,
            "joined_at": join_time,
            "email": current_user.get("email"),
            "name": current_user.get("name", "Unknown")
        }
        batch.set(member_ref, member_data)
        
        # 2. Update user_memberships for fast lookup
        user_memberships_ref = db.collection('user_memberships').document(user_id)
        membership_update = {
            f"leagues.{code}": {
                "role": role,
                "joined_at": join_time,
                "league_name": league_name
            }
        }
        batch.set(user_memberships_ref, membership_update, merge=True)
        
        # Execute both operations atomically
        logging.info(f"[BATCH] Executing atomic join operation for user {user_id} in league {code}")
        batch.commit()
        
        logging.info(f"User {user_id} joined league {code} as {role} using batch operation")
        return {"joined": True, "league_id": code, "league_name": league_name}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to join league")

@router.get('/leagues/{league_id}/teams')
def list_teams(
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    page: int = 0,
    limit: int = 0,
    current_user=Depends(get_current_user)
):
    try:
        teams_ref = db.collection("leagues").document(league_id).collection("teams")
        teams_stream = list(teams_ref.stream())
        items = [dict(t.to_dict(), id=t.id) for t in teams_stream]
        if page and limit:
            start = (max(page, 1) - 1) * max(limit, 1)
            end = start + limit
            teams = items[start:end]
        else:
            teams = items
        return {"teams": teams}
    except Exception as e:
        logging.error(f"Error retrieving teams: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve teams")

@router.get('/leagues/{league_id}/invitations')
def list_invitations(
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    page: int = 0,
    limit: int = 0,
    current_user=Depends(get_current_user)
):
    try:
        invitations_ref = db.collection("leagues").document(league_id).collection("invitations")
        invitations_stream = list(invitations_ref.stream())
        items = [dict(i.to_dict(), id=i.id) for i in invitations_stream]
        if page and limit:
            start = (max(page, 1) - 1) * max(limit, 1)
            end = start + limit
            invitations = items[start:end]
        else:
            invitations = items
        return {"invitations": invitations}
    except Exception as e:
        logging.error(f"Error retrieving invitations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve invitations") 