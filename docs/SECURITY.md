### Security

This document outlines headers/CSP, rate limits, and the authentication model implemented by the API.

---

## Security headers and HTTPS
Configured by `backend/middleware/security.py` and applied globally.

- HTTPS enforcement: redirects `http`→`https` when `FORCE_HTTPS=true` (default). Skips localhost and health endpoints.
- CORS: `ALLOWED_ORIGINS` and optional `ALLOWED_ORIGIN_REGEX`. Preflight short-circuited and response headers mirror allowed origin.
- Content Security Policy (CSP):
  - Header: `Content-Security-Policy` (or `-Report-Only` when `CSP_REPORT_ONLY=true` or `ENVIRONMENT=staging`)
  - Defaults: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <backend-origin> https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-ancestors 'none'`
  - Overrides: `CSP_CONNECT_SRC`, `CSP_ALLOW_UNSAFE_INLINE_SCRIPTS`
- Additional headers: `X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`, `X-XSS-Protection=1; mode=block`, `Referrer-Policy=strict-origin-when-cross-origin`, `Permissions-Policy` denying sensitive features, `Strict-Transport-Security` on HTTPS.
- Minimal headers are applied for hot auth/meta endpoints to reduce latency; all others receive the full set.

---

## Rate limiting
Implemented with SlowAPI in `backend/middleware/rate_limiting.py`. Limits can be tuned via environment variables.

Defaults (per client: IP + user-agent hash):
- Auth endpoints: `5/minute` (override: `RATE_LIMITS_AUTH`)
- Read endpoints: `300/minute` (`RATE_LIMITS_READ`)
- Write endpoints: `120/minute` (`RATE_LIMITS_WRITE`)
- Bulk endpoints: `30/minute` (`RATE_LIMITS_BULK`)
- Health endpoints: `600/minute` (`RATE_LIMITS_HEALTH`)

On exceed: API returns 429 with standardized JSON and `Retry-After` headers.

---

## Authentication and roles
Implemented in `backend/auth.py`.

- Auth: Firebase ID token via `Authorization: Bearer <token>`
- User bootstrap: if a valid token user has no `users/{uid}` doc, the backend auto-creates a minimal user document to unblock onboarding.
- Email verification: enforced for role-gated endpoints via `require_role(...)`.
- Roles: returned in the user doc (e.g., `organizer`, `coach`, `viewer`, `player`). Endpoints that mutate league/event/player/evaluator data require appropriate roles.

Operational notes:
- Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` with a valid service account for the backend.
- Observability: user id is attached to request context for tracing when available.


