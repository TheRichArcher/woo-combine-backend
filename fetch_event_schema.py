import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Add project root to path to allow imports
sys.path.append(os.getcwd())

from backend.utils.event_schema import get_event_schema

# Initialize Firebase (assuming implicit credentials or locally set env vars)
# If backend/main.py logic is complex, we'll just replicate the minimal init
if not firebase_admin._apps:
    try:
        # Try to use application default credentials
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'woo-combine',
        })
    except Exception:
        # Fallback to manual check or let the user know
        print("Could not initialize Firebase. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.")
        sys.exit(1)

from backend.firestore_client import db

def fetch_schema(event_id):
    print(f"Fetching schema for event: {event_id}")
    try:
        # Get the schema using the utility
        schema = get_event_schema(event_id)
        
        print("\n--- 1. SCHEMA DRILL KEYS (backend expectation) ---")
        keys = [d.key for d in schema.drills]
        print(keys)

        print("\n--- 2. CUSTOM DRILLS DETAILED ---")
        # Identify custom drills (typically IDs 20 chars long or explicit custom flag if we had one)
        # For now, we print all details to be safe
        custom_drills = []
        for d in schema.drills:
            # Heuristic: standard drills are usually snake_case words, custom are often IDs or different
            print(f"Drill: {d.key}")
            print(f"  - Name: {d.label}")
            print(f"  - Unit: {d.unit}")
            print(f"  - LowerIsBetter: {d.lower_is_better}")
            print(f"  - Min/Max: {d.min_value} / {d.max_value}")
            print("-" * 20)
            
    except Exception as e:
        print(f"Error fetching schema: {e}")

    print("\n--- 3. DIRECT FIRESTORE CHECK ---")
    try:
        custom_ref = db.collection("events").document(event_id).collection("custom_drills")
        docs = list(custom_ref.stream())
        print(f"Found {len(docs)} docs in events/{event_id}/custom_drills")
        for d in docs:
            print(f"  - {d.id}: {d.to_dict()}")
            
        # Also check league subcollection just in case? 
        # But we need league_id for that.
    except Exception as e:
        print(f"Error checking firestore: {e}")

if __name__ == "__main__":
    fetch_schema("yM3RYHD5ybLsDjtO9qih")

