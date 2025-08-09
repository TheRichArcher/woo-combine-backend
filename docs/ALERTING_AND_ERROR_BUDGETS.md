Observability, Error Budgets, and Alerting

Environments and Sentry Projects
- Production: separate Sentry projects for frontend and backend. DSNs are provided via env vars `VITE_SENTRY_DSN` and `BACKEND_SENTRY_DSN`.
- Staging: separate Sentry projects with distinct DSNs. Environment set via `VITE_SENTRY_ENVIRONMENT` and `SENTRY_ENVIRONMENT`.
- Release tagging: Both FE and BE send `release` using env vars `VITE_RELEASE`/`VITE_GIT_COMMIT` and `RELEASE`/`GIT_COMMIT`.

APM and Metrics
- Request tracing: Sentry tracing enabled with sample rates. Structured logs include latency per request.
- Firestore latency: Backend instruments Firestore operations; per-request totals logged as `firestore_calls` and `firestore_total_ms`.
- Cache metrics: Per-request `cache_hits` and `cache_misses` recorded when using cache wrapper.

Uptime Monitoring
- External monitors ping:
  - `GET https://<backend-domain>/health` every 60s (no auth)
  - `GET https://<backend-domain>/api/health` every 60s (no auth)
- Expected thresholds: >= 99.9% monthly availability.

Structured Logging Schema
- Per request JSON log fields:
  - `request_id`: UUID generated per request
  - `user_id_hash`: SHA-256 truncated hash of user id (no PII)
  - `endpoint`: path template or path
  - `method`: HTTP method
  - `status`: response status code
  - `latency_ms`: total request latency
  - `firestore_calls`, `firestore_total_ms`
  - `cache_hits`, `cache_misses`
  - `error_code`: exception type name if any

Error Budgets and SLOs
- Availability SLO (API): 99.9% monthly (error budget ~43 minutes/month).
- Latency SLO (API):
  - P50 < 150 ms; P95 < 600 ms for read endpoints.
  - P95 < 1000 ms for write endpoints.
- Error Rate SLO:
  - 5xx rate < 0.5% of requests (rolling 30m), alert at 1%.
  - Auth 401/403 spikes: alert if > 5% of requests for 10m.
- Firestore performance:
  - P95 Firestore per-request total < 300 ms; alert at > 600 ms for 15m.

Alert Policies (route to On-Call)
- Uptime checks fail 2/5: page High.
- API 5xx rate > 1% for 10m: page High.
- /health latency P95 > 300 ms for 15m: warn Medium.
- Firestore total per-request P95 > 600 ms for 15m: warn Medium.
- Frontend release error spike (Sentry) > 20 issues in 5m: page High.

On-Call Rotation
- Primary: Engineer A
- Secondary: Engineer B
- Hours: 24/7 weekly rotation, handoff Monday 09:00 local.
- Channel: `#oncall-woo-combine` Slack channel; PagerDuty escalation policy forwards to phone.

Runbook: Test Alerts
- Staging backend test alert endpoint: `GET /api/test-alert` (emits runtime error captured by Sentry). Ensure staging DSN and environment are set.
- Frontend test: from staging site, run in console:
  `Sentry.captureException(new Error('Staging FE test alert'))`
- Verify alerts are delivered to `#oncall-woo-combine`.

Setup Notes
- Env vars configured in `render.yaml` (marked sync:false should be set in Render dashboard per environment).
- Sampling rates tuned via env: FE `VITE_SENTRY_TRACES_SAMPLE_RATE`, BE `SENTRY_TRACES_SAMPLE_RATE`.


