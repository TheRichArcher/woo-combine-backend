from google.cloud import firestore
from google.oauth2 import service_account
import os
import json
import logging
import time

# Singleton Firestore client to prevent multiple connections
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        start_time = time.time()
        logging.info("[FIRESTORE] Starting client initialization...")
        
        # Use the same credential handling logic as auth.py
        creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        
        if creds_json:
            try:
                # Parse JSON credentials from environment variable
                cred_dict = json.loads(creds_json)
                credentials = service_account.Credentials.from_service_account_info(cred_dict)
                
                # PERFORMANCE: Initialize with connection pooling and faster defaults
                _firestore_client = firestore.Client(
                    credentials=credentials, 
                    project=cred_dict.get("project_id"),
                    # Add options for faster connection
                    options=firestore.ClientOptions(
                        # Enable connection pooling
                        pool_size=10,
                        # Reduce connection timeout
                        timeout=5.0
                    ) if hasattr(firestore, 'ClientOptions') else None
                )
                init_time = time.time() - start_time
                logging.info(f"[FIRESTORE] Initialized with JSON credentials in {init_time:.2f}s")
            except Exception as e:
                logging.error(f"[FIRESTORE] Failed to parse JSON credentials: {e}")
                # Fallback to default credentials
                _firestore_client = firestore.Client()
                init_time = time.time() - start_time
                logging.info(f"[FIRESTORE] Initialized with default credentials in {init_time:.2f}s")
        else:
            # Use default application credentials
            _firestore_client = firestore.Client()
            init_time = time.time() - start_time
            logging.info(f"[FIRESTORE] Initialized with default credentials in {init_time:.2f}s")
    
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

db = _FirestoreDB() 