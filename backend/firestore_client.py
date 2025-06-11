from google.cloud import firestore

# Singleton Firestore client to prevent multiple connections
_firestore_client = None

def get_firestore_client():
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.Client()
    return _firestore_client

# Lazy property that only creates client when first accessed
class _FirestoreDB:
    def __getattr__(self, name):
        client = get_firestore_client()
        return getattr(client, name)

db = _FirestoreDB() 