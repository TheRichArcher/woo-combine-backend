### Getting Started

This guide gets a new engineer productive in under a day: local dev setup, running the backend/frontend, and seeding demo data.

---

## Prerequisites
- Node.js 18+ and npm
- Python 3.11 (see `runtime.txt`)
- A Firebase project with Firestore enabled
- A Firebase service account JSON (Editor + Firestore User)

---

## 1) Clone and bootstrap

```bash
git clone <your-fork-or-repo>
cd "WooCombine App"

# Backend venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend deps
cd frontend && npm install && cd ..
```

---

## 2) Configure environment

Backend (FastAPI) required variables:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: the full service account JSON as a single-line string
- `ALLOWED_ORIGINS`: `http://localhost:5173` for local dev

Optional (recommended for local):
- `CSP_REPORT_ONLY=true`
- `LOG_LEVEL=DEBUG`

Example shell setup:
```bash
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
export ALLOWED_ORIGINS="http://localhost:5173"
export LOG_LEVEL=DEBUG
export CSP_REPORT_ONLY=true
```

Frontend (Vite) variables (create `frontend/.env.local`):
```bash
VITE_API_BASE=http://localhost:10000/api
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_APP_ID=1:xxx:web:yyy
```

See also: `docs/ENV_VARS_AND_RENDER_SETUP.md` for a complete list and Render guidance.

---

## 3) Run the services

Run backend (FastAPI):
```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 10000
```

Run frontend (Vite):
```bash
cd frontend
npm run dev
# Opens http://localhost:5173
```

Verify API is up:
- Open `http://localhost:10000/health` → `{ "status": "ok" }`
- Open `http://localhost:10000/docs` for OpenAPI UI

---

## 4) Seed demo data (optional but recommended)

Enable protected demo seeding endpoint and run the helper script:
```bash
# In the backend shell
export ENABLE_DEMO_SEED=true
export DEMO_SEED_TOKEN=dev-seed-token

# From repo root, with venv active
python3 scripts/seed_demo.py --base-url http://localhost:10000 --token dev-seed-token
```

What it does:
- Creates a demo league, two events, ~100 players across three age groups
- Adds evaluators and granular drill evaluations

You can disable seeding access by unsetting `ENABLE_DEMO_SEED` or removing the token.

---

## 5) Sign in and explore
- App uses Firebase Email/Password auth; create a user in your Firebase project
- Log in via the frontend and follow the onboarding flow
- Use the seeded data to test live rankings, CSV import, and admin tools

---

## Troubleshooting quick hits
- CORS: ensure `ALLOWED_ORIGINS` includes `http://localhost:5173`
- Auth errors: verify Firebase web config and backend service account are from the same project
- Firestore errors: ensure Firestore is enabled and the service account has permissions
- Rate limits: defaults are generous for local; override via `RATE_LIMITS_*` envs if needed


