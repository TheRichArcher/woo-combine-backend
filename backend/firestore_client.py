from google.cloud import firestore
from google.oauth2 import service_account
import os
import json
import logging
import time
from .middleware.observability import record_firestore_call

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
                
                # Initialize Firestore client with credentials
                _firestore_client = firestore.Client(
                    credentials=credentials, 
                    project=cred_dict.get("project_id")
                )
                init_time = time.time() - start_time
                logging.info(f"[FIRESTORE] Initialized with JSON credentials in {init_time:.2f}s")
            except json.JSONDecodeError as e:
                logging.error(f"[FIRESTORE] Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON: {e}")
                # Fallback to default credentials
                try:
                    _firestore_client = firestore.Client()
                    init_time = time.time() - start_time
                    logging.info(f"[FIRESTORE] Initialized with default credentials in {init_time:.2f}s")
                except Exception as default_e:
                    logging.error(f"[FIRESTORE] Failed to initialize with default credentials: {default_e}")
                    raise RuntimeError(f"Unable to initialize Firestore client: {default_e}")
            except Exception as e:
                logging.error(f"[FIRESTORE] Failed to initialize with JSON credentials: {e}")
                # Fallback to default credentials
                try:
                    _firestore_client = firestore.Client()
                    init_time = time.time() - start_time
                    logging.info(f"[FIRESTORE] Initialized with default credentials in {init_time:.2f}s")
                except Exception as default_e:
                    logging.error(f"[FIRESTORE] Failed to initialize with default credentials: {default_e}")
                    raise RuntimeError(f"Unable to initialize Firestore client: {default_e}")
        else:
            # Use default application credentials
            try:
                _firestore_client = firestore.Client()
                init_time = time.time() - start_time
                logging.info(f"[FIRESTORE] Initialized with default credentials in {init_time:.2f}s")
            except Exception as e:
                logging.error(f"[FIRESTORE] Failed to initialize with default credentials: {e}")
                logging.error("[FIRESTORE] Make sure GOOGLE_APPLICATION_CREDENTIALS_JSON is set in environment")
                raise RuntimeError(f"Unable to initialize Firestore client: {e}")
    
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

    # Wrap common operations to measure latency for APM metrics
    def collection(self, *args, **kwargs):
        client = get_firestore_client()
        return _InstrumentedCollectionReference(getattr(client, "collection")(*args, **kwargs))

db = _FirestoreDB() 


class _InstrumentedCollectionReference:
    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def document(self, *args, **kwargs):
        return _InstrumentedDocumentReference(self._inner.document(*args, **kwargs))


class _InstrumentedDocumentReference:
    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    def get(self, *args, **kwargs):
        start = time.perf_counter()
        try:
            return self._inner.get(*args, **kwargs)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000.0
            record_firestore_call(duration_ms)

    def set(self, *args, **kwargs):
        start = time.perf_counter()
        try:
            return self._inner.set(*args, **kwargs)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000.0
            record_firestore_call(duration_ms)

    def update(self, *args, **kwargs):
        start = time.perf_counter()
        try:
            return self._inner.update(*args, **kwargs)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000.0
            record_firestore_call(duration_ms)