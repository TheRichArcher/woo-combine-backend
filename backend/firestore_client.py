import os
from google.cloud import firestore

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
            # Try to create real Firestore client
            _firestore_client = firestore.Client()
            print("[FIRESTORE] Using real Firestore client")
        except Exception as e:
            print(f"[FIRESTORE] Failed to initialize real client, using mock: {e}")
            _firestore_client = MockFirestoreClient()
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

db = _FirestoreDB() 