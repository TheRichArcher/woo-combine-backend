
import os
import sys
import logging
from google.cloud import firestore

# Add current directory to path
sys.path.append(os.getcwd())

# Import db client logic
try:
    from backend.firestore_client import db
except ImportError:
    import json
    from google.oauth2 import service_account
    cred_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if cred_json:
        cred_dict = json.loads(cred_json)
        creds = service_account.Credentials.from_service_account_info(cred_dict)
        db = firestore.Client(credentials=creds, project=cred_dict.get("project_id"))
    else:
        db = firestore.Client()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_role(league_name_query, target_email=None):
    logger.info(f"🔍 Searching for league matching: '{league_name_query}'")
    
    # 1. Find League
    leagues_ref = db.collection("leagues")
    # Try exact match
    matches = list(leagues_ref.where("name", "==", league_name_query).stream())
    
    if not matches:
        # Try finding by checking all (if small DB) or ask for ID
        logger.info("   No exact match. Scanning recent leagues...")
        recent = list(leagues_ref.order_by("created_at", direction=firestore.Query.DESCENDING).limit(50).stream())
        for l in recent:
            if league_name_query.lower() in l.to_dict().get("name", "").lower():
                matches.append(l)
                
    if not matches:
        logger.error("❌ League not found.")
        return
        
    if len(matches) > 1:
        logger.warning(f"⚠️ Found {len(matches)} matching leagues. Using the first one.")
        for m in matches:
             logger.info(f"   - {m.to_dict().get('name')} (ID: {m.id})")
    
    league_doc = matches[0]
    league_id = league_doc.id
    league_name = league_doc.to_dict().get("name")
    logger.info(f"✅ Selected League: {league_name} (ID: {league_id})")
    
    # 2. Find Member
    members_ref = leagues_ref.document(league_id).collection("members")
    member_doc = None
    
    if target_email:
        logger.info(f"🔍 Searching for member with email: {target_email}")
        mem_query = list(members_ref.where("email", "==", target_email).stream())
        if mem_query:
            member_doc = mem_query[0]
    else:
        # List all members to help identify
        logger.info("🔍 Listing members to identify target:")
        all_members = list(members_ref.stream())
        for m in all_members:
            d = m.to_dict()
            logger.info(f"   - User: {d.get('name')} ({d.get('email')}) | Role: {d.get('role')} | ID: {m.id}")
            # Heuristic: if there's only one user, pick them
            if len(all_members) == 1:
                member_doc = m
        
        if not member_doc:
            logger.error("❌ Please specify target_email to fix specific user, or ensure only one user exists.")
            return

    user_id = member_doc.id
    user_data = member_doc.to_dict()
    current_role = user_data.get("role")
    email = user_data.get("email")
    
    logger.info(f"👤 Found User: {email} (ID: {user_id})")
    logger.info(f"   Current Role: {current_role}")
    
    if current_role == "organizer":
        logger.info("✅ User is already an organizer in the members collection.")
        # We should still check/fix the cache
    else:
        logger.info("🛠  User is NOT organizer. Proceeding to fix...")

    # 3. Fix Role (Atomic Batch)
    batch = db.batch()
    
    # Fix 1: League Member Doc
    batch.update(members_ref.document(user_id), {"role": "organizer"})
    
    # Fix 2: User Membership Cache
    user_mem_ref = db.collection("user_memberships").document(user_id)
    # Note: nested update syntax for map field
    batch.update(user_mem_ref, {f"leagues.{league_id}.role": "organizer"})
    
    try:
        batch.commit()
        logger.info("🚀 SUCCESS! Role updated to 'organizer' in both league members and user cache.")
    except Exception as e:
        logger.error(f"❌ Failed to commit update: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fix_league_role.py <league_name> [user_email]")
        sys.exit(1)
        
    league = sys.argv[1]
    email = sys.argv[2] if len(sys.argv) > 2 else None
    fix_role(league, email)




