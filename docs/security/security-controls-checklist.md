### Security Controls Checklist

- CSP enforced in staging (not report-only): [ ] yes  [x] no
  - connect-src entries: `'self'`, backend origin, `https://*.googleapis.com`, `https://*.firebaseio.com`, `wss://*.firebaseio.com`, plus `CSP_CONNECT_SRC` env additions
- HSTS enabled in HTTPS environments: [x] yes  [ ] no
- CORS restricted via `ALLOWED_ORIGINS`/`ALLOWED_ORIGIN_REGEX`: [x] yes
- Rate limits configured: auth 5/min, read 300/min, write 120/min, bulk 30/min, health 600/min: [x] yes
- `ENABLE_ROLE_SIMPLE=false` in prod; enabled only in non-prod for incident workarounds: [x] yes
- Debug endpoints disabled in prod (`ENABLE_DEBUG_ENDPOINTS=false`): [x] yes

Evidence (masked screenshots):
- Backend Render env (dev/staging/prod): `docs/reports/render-backend-env-[dev|staging|prod].png`
- Frontend Render env (dev/staging/prod): `docs/reports/render-frontend-env-[dev|staging|prod].png`
- Confirmations:
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON` present (masked): [ ] dev [ ] staging [x] prod
  - `ALLOWED_ORIGINS` correct per env: [ ] dev [ ] staging [x] prod
  - `ENABLE_ROLE_SIMPLE=false` in production: [x] yes

Owner sign-off: ____  Date: ____



One-sentence production check:

- ENABLE_ROLE_SIMPLE is false in production (verified on 2025-10-21).
