import os
import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

def audit_users_missing_role():
    db = firestore.Client()
    users_ref = db.collection("users")
    missing_role = []
    for user_doc in users_ref.stream():
        user_data = user_doc.to_dict()
        if "role" not in user_data or not user_data["role"]:
            missing_role.append({
                "uid": user_doc.id,
                "email": user_data.get("email", "<no email>")
            })
    if missing_role:
        print("Users missing 'role' field:")
        for user in missing_role:
            print(f"UID: {user['uid']}, Email: {user['email']}")
    else:
        print("All users have a 'role' field.")

if __name__ == "__main__":
    audit_users_missing_role() 