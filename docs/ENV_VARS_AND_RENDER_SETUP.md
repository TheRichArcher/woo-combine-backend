### WooCombine Environment Variables and Render Setup

This document lists all environment variables required across backend and frontend, where they are stored in Render, and recommended values per environment. Include screenshots of the Render Environment settings pages after entry.

---

### Backend (Render service `woo-combine-backend`)

- **GOOGLE_APPLICATION_CREDENTIALS_JSON**
  - Storage: Render → Services → `woo-combine-backend` → Environment
  - Description: Full Firebase service account JSON (Editor + Firestore User) as a single-line string
  - Dev: service account for dev project
  - Staging: service account for staging project
  - Prod: service account for prod project

- **ALLOWED_ORIGINS**
  - Storage: Render → Services → `woo-combine-backend` → Environment
  - Description: Comma-separated allowed FE origins
  - Dev: `http://localhost:5173`
  - Staging: `https://staging.woo-combine.com`
  - Prod: `https://woo-combine.com,https://www.woo-combine.com`

- **RATE_LIMITS_AUTH**
  - Storage: Render → backend → Environment
  - Description: Rate limit for auth endpoints
  - Dev: `10/min`
  - Staging: `5/min`
  - Prod: `5/min`

- **RATE_LIMITS_READ**
  - Storage: Render → backend → Environment
  - Description: Rate limit for read endpoints
  - Dev: `300/min`
  - Staging: `300/min`
  - Prod: `300/min`

- **RATE_LIMITS_WRITE**
  - Storage: Render → backend → Environment
  - Description: Rate limit for write endpoints
  - Dev: `120/min`
  - Staging: `120/min`
  - Prod: `120/min`

- **RATE_LIMITS_BULK**
  - Storage: Render → backend → Environment
  - Description: Rate limit for bulk endpoints
  - Dev: `30/min`
  - Staging: `30/min`
  - Prod: `30/min`

- **RATE_LIMITS_HEALTH**
  - Storage: Render → backend → Environment
  - Description: Rate limit for health endpoints
  - Dev: `600/min`
  - Staging: `600/min`
  - Prod: `600/min`

- **ENABLE_ROLE_SIMPLE**
  - Storage: Render → backend → Environment
  - Description: Enables temporary simple role path in onboarding
  - Dev: `true` (only for emergency onboarding)
  - Staging: `true` (temporary only)
  - Prod: `false`

- **LOG_LEVEL**
  - Storage: Render → backend → Environment
  - Description: Python logging level
  - Dev: `DEBUG`
  - Staging: `INFO`
  - Prod: `INFO`

- Optional Firebase identifiers (for logging/debug in startup):
  - **GOOGLE_CLOUD_PROJECT**: project id (dev/staging/prod)
  - **FIREBASE_PROJECT_ID**: project id (dev/staging/prod)
  - Optional: **FIREBASE_AUTH_DOMAIN**, **FIREBASE_API_KEY** (if used for any backend auth checks)

---

### Frontend (Render static site `woo-combine-frontend`)

- **VITE_API_BASE**
  - Storage: Render → Services → `woo-combine-frontend` → Environment
  - Description: Backend base URL
  - Dev: `https://<dev-backend>.onrender.com/api` or `http://localhost:10000/api` for local
  - Staging: `https://staging-woo-combine-backend.onrender.com/api` (staging backend)
  - Prod: `https://woo-combine-backend.onrender.com/api` (or custom domain path)

- **VITE_FIREBASE_API_KEY**
  - Storage: Render → frontend → Environment
  - Description: Firebase web apiKey
  - Dev/Staging/Prod: Use the corresponding Firebase web app key

- **VITE_FIREBASE_AUTH_DOMAIN**
  - Storage: Render → frontend → Environment
  - Description: Firebase authDomain
  - Dev/Staging/Prod: `<project>.firebaseapp.com`

- **VITE_FIREBASE_PROJECT_ID**
  - Storage: Render → frontend → Environment
  - Description: Firebase projectId
  - Dev/Staging/Prod: project id

- **VITE_FIREBASE_STORAGE_BUCKET**
  - Storage: Render → frontend → Environment
  - Description: Firebase storageBucket
  - Dev/Staging/Prod: `<project>.appspot.com`

- **VITE_FIREBASE_APP_ID**
  - Storage: Render → frontend → Environment
  - Description: Firebase appId
  - Dev/Staging/Prod: web app id

- Optional
  - **VITE_LOG_LEVEL** (used by `logger.js`): Dev `DEBUG`, Staging/Prod `INFO`

---

### Screenshots to capture (after entry)

Add screenshots under `docs/reports/` or paste in your issue/ticket showing:

1) Backend Render → Environment page with all variables set (mask secrets)
2) Frontend Render → Environment page with all variables set (mask secrets)

---

### Notes

- Rate limit envs support shorthand like `5/min`; backend normalizes to `5/minute`.
- Backend CORS also accepts `ALLOWED_ORIGIN_REGEX` if needed, but primary control is via `ALLOWED_ORIGINS`.
- Ensure the Firebase service account has roles: Editor + Firestore User.


