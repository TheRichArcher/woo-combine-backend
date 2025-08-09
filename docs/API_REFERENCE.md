# API Reference

This document summarizes key API endpoints. A full OpenAPI spec will be available at `/docs` in the running service.

Authentication: Bearer Firebase ID token in `Authorization` header.

Core endpoints (prefix `/api`):

- GET `/health`: Health status
- GET `/meta`: Version, feature flags
- GET `/users/me`: Current user info (auth required)
- POST `/users/role`: Set role (onboarding; token required)
- GET `/leagues/me`: List leagues for current user (auth required)
- POST `/leagues`: Create league (role: organizer)
- POST `/leagues/join/{code}`: Join league by code (auth required)
- GET `/leagues/{league_id}/events`: List events (auth required)
- POST `/leagues/{league_id}/events`: Create event (roles: organizer, coach)
- GET `/leagues/{league_id}/events/{event_id}`: Get event (auth required)
- PUT `/leagues/{league_id}/events/{event_id}`: Update event (roles: organizer, coach)
- DELETE `/leagues/{league_id}/events/{event_id}`: Delete event (role: organizer)
- GET `/players?event_id=...`: List players in event (auth required)
- POST `/players`: Create player in event (roles: organizer, coach)
- POST `/players/upload`: Bulk upload players (role: organizer)
- GET `/events/{event_id}/evaluators`: List evaluators (auth required)
- POST `/events/{event_id}/evaluators`: Add evaluator (roles: organizer, coach)
- POST `/events/{event_id}/evaluations`: Submit drill evaluation (roles: organizer, coach)
- GET `/events/{event_id}/aggregated-results`: Aggregated drill results (auth required)

Security:
- CORS restricted via `ALLOWED_ORIGINS`/`ALLOWED_ORIGIN_REGEX`
- Security headers: CSP, HSTS, X-Frame-Options, etc.
- Rate limiting via SlowAPI, categories: auth, users, read, write, bulk, health

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


