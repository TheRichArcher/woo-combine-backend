from google.cloud import firestore
import os
import json

def get_firestore_client():
    cred_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if cred_json:
        cred_dict = json.loads(cred_json)
        return firestore.Client.from_service_account_info(cred_dict)
    return firestore.Client()

db = get_firestore_client() 