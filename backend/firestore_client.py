from google.cloud import firestore
from google.oauth2 import service_account
import os
import json
import logging

# Singleton Firestore client to prevent multiple connections
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        # Use the same credential handling logic as auth.py
        creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        
        if creds_json:
            try:
                # Parse JSON credentials from environment variable
                cred_dict = json.loads(creds_json)
                credentials = service_account.Credentials.from_service_account_info(cred_dict)
                _firestore_client = firestore.Client(credentials=credentials, project=cred_dict.get("project_id"))
                logging.info("[FIRESTORE] Initialized with JSON credentials from environment")
            except Exception as e:
                logging.error(f"[FIRESTORE] Failed to parse JSON credentials: {e}")
                # Fallback to default credentials
                _firestore_client = firestore.Client()
                logging.info("[FIRESTORE] Initialized with default credentials")
        else:
            # Use default application credentials
            _firestore_client = firestore.Client()
            logging.info("[FIRESTORE] Initialized with default credentials")
    
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

db = _FirestoreDB() 