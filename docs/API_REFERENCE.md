### API Reference

The backend provides a FastAPI OpenAPI definition and interactive documentation.

- Local OpenAPI UI: `http://localhost:10000/docs`
- Local ReDoc: `http://localhost:10000/redoc`
- OpenAPI JSON: `http://localhost:10000/openapi.json`

All application routes are prefixed with `/api`.

Key route groups (see OpenAPI for full details):
- Players: `/api/players` (CRUD, CSV upload, rankings)
- Leagues: `/api/leagues`, join codes, teams, invitations
- Events: `/api/leagues/{league_id}/events` (CRUD)
- Drills and Evaluations: `/api/drill-results`, aggregated results
- Evaluators: `/api/events/{event_id}/evaluators`, evaluations
- Batch: `/api/batch/...` bulk endpoints
- Meta/Health: `/api/meta`, `/api/health`, `/api/warmup`

Auth model:
- Bearer token (Firebase ID token) on protected routes
- Email verification enforced for role-gated endpoints

Rate limits and errors are standardized. See `docs/SECURITY.md` for policies.


