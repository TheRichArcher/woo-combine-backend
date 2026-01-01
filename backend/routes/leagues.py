from fastapi import APIRouter, Depends, HTTPException, Request, Path, Query, Body
from ..firestore_client import db
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit
from datetime import datetime
import logging
from google.cloud.firestore import Query
from ..utils.database import execute_with_timeout
from ..security.access_matrix import require_permission
from ..utils.authorization import ensure_league_access

# Fixed: Removed FieldPath import to resolve deployment issues

router = APIRouter(prefix="/leagues")



@router.get('/me')
@read_rate_limit()
def get_my_leagues(request: Request, current_user=Depends(get_current_user)):
    logging.info(f"[GET] /leagues/me called by user: {current_user}")
    user_id = current_user["uid"]
    
    try:
        # FAST PATH: Direct user membership lookup (O(1) operation)
        logging.info(f"🚀 Checking user_memberships for user {user_id}")
        
        user_memberships_ref = db.collection('user_memberships').document(user_id)
        user_doc = execute_with_timeout(user_memberships_ref.get, timeout=5, operation_name="user_memberships lookup")
        
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
                league_docs = execute_with_timeout(lambda: db.get_all(league_refs), timeout=8, operation_name="batch league get")
                
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
        leagues_query = db.collection('leagues').order_by("created_at", direction=Query.DESCENDING).limit(5)
        all_leagues = execute_with_timeout(lambda: list(leagues_query.stream()), timeout=8, operation_name="leagues stream")
        
        # Check membership in each league (old way) with longer timeouts
        user_leagues = []
        migration_data = {}
        
        for league_doc in all_leagues:
            league_id = league_doc.id
            
            try:
                member_ref = db.collection('leagues').document(league_id).collection('members').document(user_id)
                member_doc = execute_with_timeout(member_ref.get, timeout=5, operation_name="member lookup")
                
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
            # CRITICAL FIX: Return 200 with empty array, not 404
            # 404 should mean "route not found", not "no data"
            # This prevents retry cascades when new users have no leagues yet
            logging.info(f"No leagues found for user {user_id} - returning empty array (new user)")
            return {"leagues": []}
        
        # MIGRATE: Create user_memberships document for future speed (async to not block response)
        if migration_data:
            try:
                migration_doc = {"leagues": migration_data}
                execute_with_timeout(lambda: user_memberships_ref.set(migration_doc), timeout=6, operation_name="user_memberships migrate")
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

@router.post('/')
@write_rate_limit()
def create_league(request: Request, req: dict, current_user=Depends(require_role("organizer"))):
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

@router.post('/join/{code}')
@write_rate_limit()
def join_league(
    request: Request,
    code: str = Path(..., regex=r"^.{1,50}$"),
    req: dict | None = None, 
    current_user=Depends(get_current_user)
):
    logging.info(f"[POST] /leagues/join/{code} called by user: {current_user} with req: {req}")
    
    # Security Check 1: Email Verification
    if not current_user.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Email verification required")
    
    user_id = current_user["uid"]
    
    # Security Check 2: Role Validation
    requested_role = req.get("role", "coach") if req else "coach"
    
    # Strictly forbid joining as organizer via public code
    if requested_role == "organizer":
         logging.warning(f"Security Alert: User {user_id} attempted to join as organizer via code. Blocked.")
         raise HTTPException(status_code=403, detail="Cannot join as organizer via public code. Please contact a league admin.")
    
    # Whitelist allowed roles
    if requested_role not in ["coach", "viewer", "player"]:
         requested_role = "coach" # Default safe fallback
         
    role = requested_role
    
    try:
        resolved_league_id = code
        joined_via_event_code = False
        
        # PERFORMANCE: Attempt direct league lookup first
        league_ref = db.collection("leagues").document(resolved_league_id)
        league_doc = league_ref.get()
        
        if not league_doc.exists:
            logging.warning(f"League document does not exist for ID: {code}. Attempting event fallback.")
            event_ref = db.collection("events").document(code)
            event_doc = event_ref.get()
            
            if not event_doc.exists:
                logging.warning(f"No league or event found for code: {code}")
                raise HTTPException(status_code=404, detail="League not found")
            
            event_data = event_doc.to_dict() or {}
            fallback_league_id = event_data.get("league_id")
            if not fallback_league_id:
                logging.error(f"Event {code} is missing league_id reference")
                raise HTTPException(status_code=404, detail="League not found for this event code")
            
            logging.info(f"Treated join code {code} as event ID. Resolved league {fallback_league_id}")
            resolved_league_id = fallback_league_id
            joined_via_event_code = True
            
            league_ref = db.collection("leagues").document(resolved_league_id)
            league_doc = league_ref.get()
            
            if not league_doc.exists:
                logging.error(f"Event {code} referenced missing league {resolved_league_id}")
                raise HTTPException(status_code=404, detail="League not found for this event code")
        
        member_ref = league_ref.collection("members").document(user_id)
        existing_member = member_ref.get()
        
        league_data = league_doc.to_dict()
        league_name = league_data.get("name", "Unknown League")
        
        if existing_member.exists:
            logging.warning(f"User {user_id} already in league {resolved_league_id}")
            # Return success with league name even if already a member
            return {
                "joined": True, 
                "league_id": resolved_league_id, 
                "league_name": league_name,
                "joined_via_event_code": joined_via_event_code
            }
        
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
            f"leagues.{resolved_league_id}": {
                "role": role,
                "joined_at": join_time,
                "league_name": league_name
            }
        }
        batch.set(user_memberships_ref, membership_update, merge=True)
        
        # Execute both operations atomically
        logging.info(f"[BATCH] Preparing to write membership to paths:")
        logging.info(f"  1. {member_ref.path}")
        logging.info(f"  2. {user_memberships_ref.path} (update)")
        
        logging.info(f"[BATCH] Executing atomic join operation for user {user_id} in league {resolved_league_id}")
        batch.commit()
        logging.info(f"[BATCH] Successfully committed membership writes for user {user_id}")
        
        logging.info(f"User {user_id} joined league {resolved_league_id} as {role} using batch operation")
        response_payload = {
            "joined": True,
            "league_id": resolved_league_id,
            "league_name": league_name
        }
        if joined_via_event_code:
            response_payload["joined_via_event_code"] = True
        return response_payload
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to join league")

@router.get('/{league_id}/teams')
@read_rate_limit()
@require_permission("teams", "list", target="league", target_param="league_id")
def list_teams(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    page: int = 0,
    limit: int = 0,
    current_user=Depends(get_current_user)
):
    try:
        teams_ref = db.collection("leagues").document(league_id).collection("teams")
        # Bound list stream to avoid long-hanging requests
        teams_stream = execute_with_timeout(
            lambda: list(teams_ref.stream()),
            timeout=8,
            operation_name="teams stream"
        )
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

@router.get('/{league_id}/invitations')
@read_rate_limit()
@require_permission("invitations", "list", target="league", target_param="league_id")
def list_invitations(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    page: int = 0,
    limit: int = 0,
    current_user=Depends(get_current_user)
):
    try:
        invitations_ref = db.collection("leagues").document(league_id).collection("invitations")
        invitations_stream = execute_with_timeout(
            lambda: list(invitations_ref.stream()),
            timeout=8,
            operation_name="invitations stream"
        )
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

@router.get('/{league_id}/members')
@read_rate_limit()
@require_permission("league_members", "list", target="league", target_param="league_id")
def list_league_members(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    try:
        members_ref = db.collection("leagues").document(league_id).collection("members")
        # Use stream for efficient listing
        members_stream = execute_with_timeout(
            lambda: list(members_ref.stream()),
            timeout=8,
            operation_name="league members stream"
        )
        
        members = []
        for doc in members_stream:
            data = doc.to_dict()
            data["id"] = doc.id
            members.append(data)
            
        return {"members": members}
    except Exception as e:
        logging.error(f"Error listing league members: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list league members")

@router.patch('/{league_id}/members/{member_id}/status')
@write_rate_limit()
@require_permission("league_members", "update", target="league", target_param="league_id")
def update_member_status(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    member_id: str = Path(..., regex=r"^.{1,50}$"),
    status_data: dict = Body(...),
    current_user=Depends(get_current_user)
):
    try:
        disabled = status_data.get("disabled")
        if disabled is None:
            raise HTTPException(status_code=400, detail="Missing 'disabled' field in body")
            
        logging.info(f"[PATCH] Updating member {member_id} status in league {league_id} to disabled={disabled}")
        
        # ORPHAN PROTECTION: If disabling, check if this is the last active organizer
        if disabled:
             member_ref = db.collection("leagues").document(league_id).collection("members").document(member_id)
             member_doc = execute_with_timeout(lambda: member_ref.get(), timeout=5)
             
             if member_doc.exists and member_doc.to_dict().get("role") == "organizer":
                 # Check for other active organizers
                 orgs_ref = db.collection("leagues").document(league_id).collection("members")
                 # Get all organizers and check disabled status in memory
                 organizers = list(orgs_ref.where("role", "==", "organizer").stream())
                 active_count = 0
                 is_target_active = False
                 
                 for org in organizers:
                     org_data = org.to_dict()
                     if not org_data.get("disabled", False):
                         active_count += 1
                         if org.id == member_id:
                             is_target_active = True
                 
                 # If the target user is currently active and there are no other active organizers
                 if is_target_active and active_count <= 1:
                     raise HTTPException(status_code=400, detail="Cannot disable the last active organizer. Promote another member first.")
        
        batch = db.batch()
        
        # 1. Update legacy member document
        member_ref = db.collection("leagues").document(league_id).collection("members").document(member_id)
        batch.update(member_ref, {"disabled": disabled})
        
        # 2. Update user_memberships (FAST PATH)
        # We must update the nested field leagues.{league_id}.disabled
        user_membership_ref = db.collection("user_memberships").document(member_id)
        # Check if document exists first to avoid error on update
        user_doc = user_membership_ref.get()
        if user_doc.exists:
            batch.update(user_membership_ref, {f"leagues.{league_id}.disabled": disabled})
        else:
            logging.warning(f"User membership doc not found for {member_id}, skipping fast path update")
            
        batch.commit()
        
        return {"success": True, "disabled": disabled}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating member status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update member status")
 