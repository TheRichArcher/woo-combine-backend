### Credential Outage Runbook — GOOGLE_APPLICATION_CREDENTIALS_JSON invalid/expired

Owners
- Primary: Backend On-Call (Engineer A)
- Secondary: Engineer B

SLAs
- Acknowledgement: High 5m / Medium 15m / Low 60m
- Mitigation: High 30m / Medium 2h / Low 1 business day
- Root Cause Analysis: within 2 business days after resolution

Signals
- Backend startup/logs show: "[FIRESTORE] Failed to initialize with JSON credentials" or "Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON"
- Auth logs show: "[AUTH] No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using Application Default" unexpectedly
- API returns 5xx on endpoints that require Firestore

Immediate Triage (≤ 5 minutes)
1) Confirm impact
   - Check health: `GET /health` and `GET /api/health`.
   - Review Render logs for the backend service for the above FIRESTORE/AUTH messages.
2) Verify env configuration
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set in Render for the affected environment. See `docs/ENV_VARS_AND_RENDER_SETUP.md`.
   - Validate the JSON: copy the value locally and run `jq .` to ensure it parses.

Mitigation Paths
- Fast path (preferred): Fix env var and redeploy
  1) Obtain correct service account JSON (Editor + Cloud Datastore User/Firestore User) for the target GCP project.
  2) In Render → Backend service → Environment, update `GOOGLE_APPLICATION_CREDENTIALS_JSON` with the single-line JSON string.
  3) Trigger a deploy/restart. Verify logs show: "[FIRESTORE] Initialized with JSON credentials".
  4) Re-test `/api/health` and a representative read/write endpoint.

- Temporary fallback (if JSON not immediately available):
  - Remove the broken env var; backend will attempt Application Default Credentials (ADC). Only do this if the runtime has IAM access via its environment (rare on Render). Otherwise this does not restore service.

Validation
1) Smoke tests: 
   - `GET /api/health` → 200
   - One read and one write endpoint (e.g., players list and create) → success
2) Frontend basic flows load without credential errors in logs.

Prevention & Rotation
- Schedule annual key rotation (see `docs/checklists/FINAL_CLEANUP_CHECKLIST.md`).
- Store per-environment JSONs in a secure secret manager; avoid manual copy-paste.
- Keep minimal roles: Editor + Firestore User; avoid Owner.

References
- Backend initialization: `backend/firestore_client.py`
- Auth credential handling: `backend/auth.py`
- Env documentation: `docs/ENV_VARS_AND_RENDER_SETUP.md`

