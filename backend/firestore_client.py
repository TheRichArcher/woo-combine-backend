from google.cloud import firestore

def get_firestore_client():
    return firestore.Client()

db = get_firestore_client() 