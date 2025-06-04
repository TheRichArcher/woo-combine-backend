# woo-combine-backend
FastAPI backend for Woo-Combine platform

## Database
This backend uses **Google Firestore** (Firebase Admin SDK) for all data storage. All previous Postgres/SQLAlchemy code has been removed.

## Required Environment Variables
Set these in your deployment environment (e.g., Render, .env):

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to your Firebase Admin SDK service account JSON file
- (Optional) `FIREBASE_PROJECT_ID`: Your Firebase project ID (if needed for Firestore client)

## Setup
- Ensure your service account JSON is available and referenced by `GOOGLE_APPLICATION_CREDENTIALS`.
- No Postgres or SQLAlchemy dependencies are required.

## Deployment
- Remove any Postgres-related environment variables from your deployment config and .env files.
- Only the Firebase Admin SDK variables are required.

## Running Tests
- Use `pytest` or your preferred test runner to test all endpoints (CRUD, auth, onboarding, etc.).
- Check logs for Firestore operation successes and errors.
- Ensure no SQLAlchemy/Postgres errors appear in logs.

## Logs & Monitoring
- All Firestore operations are logged (successes and errors).
- Integrate error monitoring (e.g., Sentry, LogRocket) for backend and frontend.
- Set up alerts for failed requests or exceptions in production.

## Manual Deployment Steps
- Double-check Render environment variables—no Postgres/SQLAlchemy variables should remain.
- Redeploy backend after all changes.
- Smoke test the deployed backend (health check, CRUD, auth).
