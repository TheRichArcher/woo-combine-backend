### Screenshot Guide for Production Sign‑off

Add masked screenshots of Render environment variables and settings using the exact filenames below. Do not include secrets. Redact API keys, DSNs, and private keys; leave variable names and high-level values visible (e.g., domain names, booleans).

Required files
- render-backend-env-dev.png
- render-backend-env-staging.png
- render-backend-env-prod.png
- render-frontend-env-dev.png
- render-frontend-env-staging.png
- render-frontend-env-prod.png

Capture checklist
- Backend service → Settings → Environment: show `ALLOWED_ORIGINS`, `ENABLE_DEBUG_ENDPOINTS=false`, `ENABLE_ROLE_SIMPLE=false`, rate limits, `FORCE_HTTPS=true`, and presence of `GOOGLE_APPLICATION_CREDENTIALS_JSON` (redacted).
- Frontend static site → Settings → Environment: show `VITE_API_BASE`, CSP-related variables if any, Sentry DSN (redacted), release/commit metadata (`VITE_RELEASE`, `VITE_GIT_COMMIT`).
- Domains: include the custom domain mapping for staging/prod where applicable.

Notes
- Store screenshots in this folder with the names above so checklists can reference them directly.
- If you update environments later, replace these screenshots to keep evidence current.

