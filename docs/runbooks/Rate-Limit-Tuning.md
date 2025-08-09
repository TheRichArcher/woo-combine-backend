### Rate Limit Tuning Runbook — what to change, where, and how to validate

Owners
- Primary: Backend On-Call (Engineer A)
- Secondary: Engineer B

SLAs
- Non-incident tuning: within 1 business day
- During incident: align with incident SLAs

Where to change
- Environment variables (Render → backend service):
  - `RATE_LIMITS_AUTH` (default `5/minute`)
  - `RATE_LIMITS_USERS` (default `300/minute`)
  - `RATE_LIMITS_READ` (default `300/minute`)
  - `RATE_LIMITS_WRITE` (default `120/minute`)
  - `RATE_LIMITS_BULK` (default `30/minute`)
  - `RATE_LIMITS_HEALTH` (default `600/minute`)
- Code that applies limits: `backend/middleware/rate_limiting.py`
  - Normalizes shorthand like `5/min` → `5/minute`.
  - Decorators applied across routes (see usages in `backend/routes/*`).

How to change
1) Decide new thresholds per endpoint category based on traffic and error budget.
2) Update the env vars above with human-readable values (`X/min`, `X/second`, `X/hour`).
3) Save and trigger a redeploy. Verify startup log line showing configured limits.

Validation
1) Automated: Run the script to ensure 429s appear at the expected threshold:
   - `TOKEN=... RATE_LIMIT_TARGET=https://<backend>/api/users/me COUNT=330 bash scripts/testing/rate_limit_test.sh`
   - Expect: at least one 429 and JSON response includes `category=rate_limit`.
2) Manual: Exercise read/write/bulk endpoints and confirm fair-use behavior without customer impact.
3) Monitoring: Watch Sentry and logs for rate limit violations and overall throughput.

Operational tips
- Keep auth stricter than general reads to dampen attack/bot bursts.
- Bulk operations should be limited tightly; increase temporarily for admin-only windows if needed.
- The abuse-protection middleware provides an additional PoW challenge for auth-specific bursts; tune via `ABUSE_*` envs.

References
- Middleware: `backend/middleware/rate_limiting.py`
- Abuse protection: `backend/middleware/abuse_protection.py`
- Env doc: `docs/ENV_VARS_AND_RENDER_SETUP.md`
- Test script: `scripts/testing/rate_limit_test.sh`

