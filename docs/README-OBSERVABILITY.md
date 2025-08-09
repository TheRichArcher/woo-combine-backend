Frontend
- Sentry initialized in `frontend/src/main.jsx` using `VITE_SENTRY_DSN`, environment `VITE_SENTRY_ENVIRONMENT`, and release tag `VITE_RELEASE`/`VITE_GIT_COMMIT`.
- Tracing and Replay enabled with configurable rates.

Backend
- Sentry initialized via `BACKEND_SENTRY_DSN` in `backend/middleware/observability.py`.
- `ObservabilityMiddleware` adds `X-Request-ID`, structured JSON logs, and aggregates Firestore timings and cache hits/misses.
- Firestore client wrapper measures latency for `get/set/update` per document.
- APM sampling and profiles controlled by `SENTRY_TRACES_SAMPLE_RATE` and `SENTRY_PROFILES_SAMPLE_RATE`.
- Health endpoints available: `/health` and `/api/health`.
- Test alert endpoint (staging): `/api/test-alert`.

Env Vars Summary
- Frontend: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_RELEASE`, `VITE_GIT_COMMIT`, tracing and replay rates.
- Backend: `BACKEND_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `RELEASE`, `GIT_COMMIT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`.

Uptime
- Configure external monitors for `/health` and `/api/health` every 60s.

On-Call
- See `docs/ALERTING_AND_ERROR_BUDGETS.md` for SLOs, error budgets, thresholds, and rotation.


