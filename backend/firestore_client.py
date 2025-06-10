import os
import json
from google.cloud import firestore
from google.oauth2 import service_account

# Mock Firestore for local development when credentials aren't available
class MockFirestoreClient:
    def collection(self, name):
        return MockCollection(name)
    
class MockCollection:
    def __init__(self, name):
        self.name = name
    
    def document(self, doc_id=None):
        return MockDocument(doc_id or "mock_doc")
    
    def limit(self, count):
        return self
    
    def stream(self):
        return []
    
    def collection_group(self, name):
        return MockQuery(name)
    
class MockQuery:
    def __init__(self, name):
        self.name = name
    
    def where(self, field, op, value):
        return self
    
    def stream(self):
        return []

class MockDocument:
    def __init__(self, doc_id):
        self.id = doc_id
    
    def set(self, data):
        print(f"[MOCK] Would set document data: {data}")
        return True
    
    def get(self):
        return MockDocumentSnapshot()
    
    def collection(self, name):
        return MockCollection(name)

class MockDocumentSnapshot:
    def exists(self):
        return False
    
    def to_dict(self):
        return {}

# Singleton Firestore client to prevent multiple connections
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        try:
            # Try multiple ways to initialize Firestore client
            credentials = None
            project_id = None
            
            # Method 1: Check for JSON credentials in environment variable
            creds_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
            if creds_json:
                try:
                    creds_dict = json.loads(creds_json)
                    credentials = service_account.Credentials.from_service_account_info(creds_dict)
                    project_id = creds_dict.get('project_id')
                    print("[FIRESTORE] Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON")
                except Exception as e:
                    print(f"[FIRESTORE] Failed to parse JSON credentials: {e}")
            
            # Method 2: Check for project ID in environment
            if not project_id:
                project_id = os.getenv('GOOGLE_CLOUD_PROJECT') or os.getenv('FIREBASE_PROJECT_ID')
            
            # Method 3: Try default credentials (for local development with gcloud)
            if credentials and project_id:
                _firestore_client = firestore.Client(credentials=credentials, project=project_id)
            elif project_id:
                _firestore_client = firestore.Client(project=project_id)
            else:
                _firestore_client = firestore.Client()
                
            print(f"[FIRESTORE] Successfully initialized real Firestore client for project: {project_id}")
            
        except Exception as e:
            print(f"[FIRESTORE] Failed to initialize real client, using mock: {e}")
            print("[FIRESTORE] This is normal for local development without Firebase credentials")
            _firestore_client = MockFirestoreClient()
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

db = _FirestoreDB() 