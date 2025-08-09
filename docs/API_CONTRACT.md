## WooCombine API Contract (Staging)

Version: 1.0.2

- Routers registered: `users`, `leagues`, `events`, `players`, `drills`, `evaluators`, `batch`, `health` (health endpoints in `main.py`).
- Middleware order: security headers → CORS → rate limiting → request validation → routing.
- Auth: Firebase JWT required on protected routes. Email verification enforced on role-gated endpoints. `require_role` checks role and verified email.
- Roles: `require_role` applied to create/update/delete endpoints for leagues, events, players, evaluators, drills.
- Rate limits:
  - auth (login/role): 5/min
  - read (GET): 300/min
  - write (POST/PUT/PATCH/DELETE): 120/min
  - bulk (CSV upload/batch): 30/min
  - health: 600/min

### Health & Warmup
- GET `/health` → 200 OK, lightweight, no DB. Category: health.
- GET `/api/health` → Firestore check. Category: health.
- GET `/api/warmup` → primes Firestore/Auth/routes. Category: health.

### Users
- GET `/api/users/me`
  - Auth: bearer required
  - Rate: users/read
  - Response 200: `{ id, email, role, created_at }`
  - Errors: 401, 500

- POST `/api/users/role`
  - Auth: bearer required
  - Rate: auth
  - Body: `{ role: "organizer"|"coach"|"viewer"|"player" }`
  - Response 200: `{ id, email, role, message }`
  - Errors: 400, 401, 403, 500

### Leagues
- GET `/api/leagues/me`
  - Auth: bearer
  - Rate: read
  - 200: `{ leagues: [...] }`

- POST `/api/leagues`
  - Auth: bearer + role `organizer`
  - Rate: write
  - Body: `{ name: string }`
  - 200: `{ league_id }`

- POST `/api/leagues/join/{code}`
  - Auth: bearer
  - Rate: write
  - 200: `{ joined: boolean, league_id, league_name }`

- GET `/api/leagues/{league_id}/teams` (read 300/min)
- GET `/api/leagues/{league_id}/invitations` (read 300/min)

### Events
- GET `/api/leagues/{league_id}/events` (read)
- GET `/api/leagues/{league_id}/events/{event_id}` (read)
- POST `/api/leagues/{league_id}/events` (write, role: organizer|coach)
- PUT `/api/leagues/{league_id}/events/{event_id}` (write, role: organizer|coach)
- DELETE `/api/leagues/{league_id}/events/{event_id}` (write, role: organizer)

### Players
- GET `/api/players?event_id=...` (read)
  - Response: `PlayerSchema[]` with `composite_score`
- POST `/api/players` (write, role: organizer|coach)
- PUT `/api/players/{player_id}` (write, role: organizer|coach)
- POST `/api/players/upload` (bulk, role: organizer)
  - Limits: file size ≤ 5MB (client enforced), rows ≤ 5,000; duplicates rejected by `playerId` or `(first,last,number)` within same event.
  - Response: `{ added: number, errors: [{ row, message }] }`

### Drills
- POST `/api/drill-results/` (write, role: organizer|coach)

### Evaluators
- GET `/api/events/{event_id}/evaluators` (read)
- POST `/api/events/{event_id}/evaluators` (write, role: organizer|coach)
- POST `/api/events/{event_id}/evaluations` (write, role: organizer|coach, requires verified email)
- GET `/api/events/{event_id}/players/{player_id}/evaluations` (read)
- GET `/api/events/{event_id}/aggregated-results` (read)

### Batch (max_items_per_batch = 200)
- POST `/api/batch/events` → events by league IDs (bulk)
- POST `/api/batch/players` → players by event IDs (bulk)
- GET `/api/batch/dashboard-data/{leagueId}` → combined data (bulk)
- POST `/api/batch/events-by-ids` → multiple events by IDs (bulk)

### Errors
- 400: validation error
- 401: auth required/invalid
- 403: email not verified or insufficient role
- 404: not found
- 413: request too large
- 429: rate limit exceeded
- 500/504: server/database issues

Note: All endpoints return standardized JSON error `{ detail: string }`.


