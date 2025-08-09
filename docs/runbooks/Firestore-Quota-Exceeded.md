### Firestore Quota Exceeded Runbook — reads/writes exceeded

Owners
- Primary: Backend On-Call (Engineer A)
- Secondary: Engineer B

SLAs
- Acknowledgement: High 5m / Medium 15m / Low 60m
- Mitigation: High 30m / Medium 2h / Low 1 business day
- Root Cause Analysis: within 2 business days after resolution

Signals
- Elevated 429/RESOURCE_EXHAUSTED from Firestore operations in logs/Sentry
- P95 Firestore total per request breaching thresholds (see `docs/ALERTING_AND_ERROR_BUDGETS.md`)
- Render logs show spikes in read/write operations or request volume

Immediate Triage (≤ 5 minutes)
1) Confirm scope
   - Review Sentry issues tagged with `RESOURCE_EXHAUSTED` or 429 from Firestore.
   - Check Render logs for repeated failures on high-volume endpoints.
2) Identify hot paths
   - Look for endpoints with most traffic: users, players list, live standings, bulk operations.

Mitigation Strategy
1) Throttle at API edge
   - Tighten rate limits via env (Render → backend):
     - `RATE_LIMITS_READ` (e.g., reduce from `300/min` to `120/min`)
     - `RATE_LIMITS_WRITE` (e.g., reduce from `120/min` to `60/min`)
     - `RATE_LIMITS_BULK` (e.g., reduce from `30/min` to `10/min`)
   - Save and redeploy. Limits are normalized by `backend/middleware/rate_limiting.py`.

2) Backoff client retries
   - Frontend backoff is exponential in `useAsyncOperation.js` and `constants/app.js`.
   - If bursts persist, reduce retries or increase delay:
     - `APP_CONFIG.RETRY.MAX_RETRIES` → 1
     - `APP_CONFIG.RETRY.RETRY_DELAY_BASE` → 1500–3000 ms

3) Feature flags to reduce burst
   - Enable abuse protection for auth bursts:
     - `ABUSE_PROTECTION_ENABLED=true`
     - Optionally increase `ABUSE_WINDOW_SECONDS` or lower `ABUSE_MAX_REQUESTS` for auth endpoints during incident.
   - Temporarily disable emergency paths:
     - Ensure `ENABLE_ROLE_SIMPLE=false` in production to avoid high-read onboarding shortcuts.

4) Cache and fetch hygiene (longer-term mitigations)
   - Ensure FE uses `withCache` wrappers (`frontend/src/utils/dataCache.js`) for lists that refresh often (players, standings).
   - Audit endpoints to avoid N+1 document reads; batch where possible.

Validation
1) Run rate limit test selectively to verify 429 at new thresholds: `scripts/testing/rate_limit_test.sh`.
2) Monitor Firestore error rate and per-request `firestore_total_ms` metric trend down.

Rollback
- Once stable for 30–60 minutes, gradually restore `RATE_LIMITS_*` values.
- Return FE retry settings to defaults.

References
- Rate limiting: `backend/middleware/rate_limiting.py`, envs in `docs/ENV_VARS_AND_RENDER_SETUP.md`
- Abuse protection: `backend/middleware/abuse_protection.py`
- Frontend retry/backoff: `frontend/src/hooks/useAsyncOperation.js`, `frontend/src/constants/app.js`
- Caching: `frontend/src/utils/dataCache.js`

