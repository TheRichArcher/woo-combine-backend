# WooCombine PM Onboarding Overview

_Last updated: November 30, 2025_

This guide equips a new product manager with the context required to steer WooCombine without delays. It condenses product goals, architecture, operational realities, and recent fixes so prioritization can start immediately.

---

## 1. Status Snapshot

- **Product health**: All core flows (signup → guided setup → roster → live entry → rankings) confirmed working in production after extensive UX/security fixes.
- **Deployment**: Hosted on Render (frontend + backend). Cold starts still occur after ~15 minutes of inactivity; frontend now handles them with retries and informative toasts.
- **Auth**: Email/password only, Firebase-based with enforced email verification. Phone auth and reCAPTCHA fully removed.
- **Key risk**: Project is overdue; documentation lags behind implementation. Need structured backlog + release discipline.

---

## 2. Product Goals & Personas

| Persona | Primary Goals | Surfaces |
| --- | --- | --- |
| League Operator (Organizer) | Create leagues/events, invite staff/parents, manage roster, run live combine, export results | Guided Setup, Admin Tools, Players page, Live Entry |
| Coach | Evaluate players, adjust drill weights, enter results, run drafts | Players page (weight controls + rankings), Live Entry |
| Viewer/Parent | Explore rankings with custom weight presets, see how priorities affect outcomes | Players page (read-only data, fully interactive sliders) |
| Internal Admin | Monitor onboarding, unblock users, handle support escalations | Toast/log monitoring, Render dashboards, Firestore |

Value proposition: streamlined onboarding with QR-based invitations, intuitive weight-adjustable rankings, and live data capture tailored for youth combines.

---

## 3. Critical User Journeys

1. **New Organizer Guided Setup**
   - Signup → VerifyEmail (auto-refresh + redirect) → Home detects no leagues → LeagueFallback “Start Guided Setup” → CreateLeague → OnboardingEvent wizard (creates first event, shares QR codes, guides roster setup, exposes Admin Tools & Live Entry).
2. **Invited Coach/Viewer via QR**
   - Scan role-specific QR (URL encodes league, event, intended role) → JoinEvent stores pending intent, enforces login/signup → SelectRole only shows allowed role → automatic league/event join → lands on Players page with appropriate permissions.
3. **Daily Operations**
   - Dashboard (`Home.jsx`) checks `selectedLeagueId` / `selectedEvent`. If event missing, EventSelector renders with create/join pathways. Once set, users access Players, Admin Tools, Live Entry, Exports without loops.
4. **Player Evaluation**
   - Players page has two tabs: `Player Management & Rankings` (compact sliders, presets, unified list) and `Export & Reports`. Weight sliders update rankings instantly; normalized scoring keeps totals in 0–500 range.

---

## 4. Architecture & Integrations

### Frontend
- **Stack**: React + Vite, Tailwind CSS.
- **Contexts**:
  - `AuthContext.jsx` – single source for user, roles, selected league/event, onboarding flags, logout logic (circular dependency removed).
  - `EventContext.jsx` – lightweight container for events + selected event to avoid temporal dead zones.
  - `ToastContext.jsx` – global notifications, especially Render cold-start messaging.
- **Key modules**: `Players.jsx` (weight logic, player grouping, presets), `PlayerDetailsModal.jsx`, `OnboardingEvent.jsx`, `AdminTools.jsx`, `JoinEvent.jsx`, `SelectRole.jsx`.
- **API client**: `frontend/src/lib/api.js` uses Axios with 45s timeout, exponential backoff, and fallback API URL.

### Backend
- **Stack**: FastAPI on Python 3, Firebase Admin SDK for auth verification, Firestore as primary datastore.
- **Main services**: `backend/routes/{users, leagues, events, players, drills}.py`.
- **Security**: Access matrix in `backend/security/access_matrix.py`, auth middleware ensures Firebase tokens validated server-side.
- **Hosting**: Render free tier (Auto deploy from main). Root endpoint responds to GET/HEAD for Render health.

### External Services
- Firebase Authentication (email/password) – no direct Firestore reads from frontend.
- Google Firestore – all reads/writes proxied through backend.

---

## 5. Security & Role Enforcement

- **Role-specific QR codes**: Admin Tools shows distinct coach (blue) and viewer (green) codes → URLs include `/join-event/{leagueId}/{eventId}/{role}`. SelectRole enforces intended role and auto-selects when provided.
- **Viewer experience**: Full access to sliders and rankings (read-only) to explore scenarios; no access to player management, live entry, or admin tools.
- **Organizer defaults**: League Operator role is default for self-service onboarding; prior invitation requirement removed to avoid blocking new users.
- **Auth hardening**: VerifyEmail auto-refresh limited to its route (prevents background auth reload loops). Logout clears pending invitation state. No direct Firestore operations in frontend.

---

## 6. Deployment & Environments

| Surface | Host | Notes |
| --- | --- | --- |
| Frontend | Render: `woo-combine.com` | Production only workflow; user prefers testing in prod |
| Backend | Render: `woo-combine-backend.onrender.com` | 45s timeout allowances; debug endpoints retained |
| Firestore | Google Cloud | No local emulator documented |

**Cold start strategy**: API client retries (3s → 6s → 12s) up to 45s; toasts warn users after 5s and suppress duplicates via `coldStartActive` flag.

**Deploy process**: Render auto-deploys from `main`. No branch policy documented. Need release checklist + rollback steps (gap).

---

## 7. Operational Runbook

- **Testing expectations**: Validate changes directly on production site (per stakeholder preference). Smoke flows: signup/verify, guided setup, QR join (coach + viewer), Players weight sliders, Admin Tools modals, Live Entry entry and exports.
- **Monitoring**: Manual—Render logs + browser console. No automated alerting or uptime checks beyond Render health endpoints.
- **Incident handling**:
  - If backend cold, wait for Render boot (45s). Toasts notify users; no manual intervention needed.
  - If API loops/404 storms occur, inspect `AuthContext` hydration and EventContext watchers (historical hot spots).
  - Debug endpoints listed in `PM_HANDOFF_GUIDE.md` still available but mostly idle since system stabilized.
- **User support**: Provide context on expected cold-start delays; emphasize viewer role limitations for parents.

---

## 8. Key Files & Directories

```
frontend/src/
├── context/
│   ├── AuthContext.jsx          # Auth + league/event state, logout
│   ├── EventContext.jsx         # Events per league, minimal logic
│   └── ToastContext.jsx         # Cold-start and UX toasts
├── pages/
│   ├── Home.jsx                 # Dashboard routing + EventSelector
│   ├── OnboardingEvent.jsx      # Guided setup wizard
│   ├── Players.jsx              # Weight controls, rankings, exports
│   ├── AdminTools.jsx           # QR codes, roster upload, modals
│   ├── SelectRole.jsx / JoinEvent.jsx
│   └── VerifyEmail.jsx          # Auto-refresh + redirect
└── lib/api.js                   # Axios instance with retries/backoff

backend/
├── main.py                      # FastAPI app, middleware, health endpoints
├── routes/
│   ├── users.py                 # /api/users/me, role updates
│   ├── leagues.py               # League CRUD, selection flows
│   ├── events.py                # Event creation/selection
│   └── players.py               # Player upload, numbering, stats
├── middleware/                  # Rate limiting, security, observability
└── security/access_matrix.py    # Role permission mapping

docs/
└── guides/                      # Existing runbooks (e.g., PM_HANDOFF_GUIDE.md, RENDER_DEPLOYMENT.md)
```

---

## 9. Recent Fix Highlights (Context for Decisions)

- **Infinite API loop resolved**: AuthContext and Players fetch loops eliminated by stabilizing dependency arrays and moving initialization inline.
- **Guided setup clarity**: Signup success messaging, auto redirect to VerifyEmail, improved LeagueFallback copy, OnboardingEvent “What’s Next?” guidance, and removal of redundant buttons/toasts.
- **QR security**: Enforced role intention across JoinEvent → SelectRole; logout cleans pending invites; viewer restrictions clearly communicated.
- **Weight slider overhauls**: Multiple iterations culminating in independent 0–100 sliders with `defaultValue + onInput + onPointerUp` pattern, normalized scoring, compact layout, and smoothing fixes (no console.log overhead).
- **Players page**: Reduced to two tabs, default `players` tab, compact ranking view at top, real-time updates, All Players dropdown option.
- **CSV and numbering**: Upload now only requires first/last/age, flexible headers, unique numbering that considers existing players before assignment.
- **Cold start UX**: Toast deduping, API retries/backoff, Render health HEAD support, documentation of expected delays.

See `docs/reports/*.md` for specialized audits (QR_CODE_EVENT_JOIN_AUDIT_RESULTS.md, SLIDER_FIXES_SUMMARY.md, etc.).

---

## 10. Known Risks & Debt

- **Observability gap**: No monitoring/alerting beyond manual log checks. Recommend lightweight uptime + error tracking.
- **Release governance**: No documented review/approval process or staging environment. Need release checklist + gating tests.
- **Documentation drift**: Legacy guides (e.g., existing PM handoff) reference older debug state. This file should become source of truth.
- **Cold start latency**: Still dependent on Render free tier; consider paid plan or scheduled warmers if user complaints persist.
- **Compliance/privacy**: Youth data handling guidelines exist in `docs/legal/`, but enforcement responsibilities unclear.

---

## 11. Backlog Starting Points

1. **Governance**: Define release pipeline (branching, approvals, prod validation). Document manual smoke tests.
2. **Telemetry**: Add basic metrics (e.g., Render cron ping, Sentry/Logtail) for API success/failure, slider usage, onboarding drop-offs.
3. **Experience polish**: Evaluate viewer-specific messaging, add analytics to understand slider preset usage, consider offline/print exports.
4. **Scalability**: Review Firestore indexes (see `docs/INDEXES.md`), ensure numbering + normalization performant for large rosters.
5. **Support tooling**: Build lightweight admin dashboard for user impersonation or league support tasks (currently manual).

---

## 12. Open Questions for the PM

- What constitutes “project completion” for current stakeholders (feature parity, reporting, monetization)?
- Are there external commitments (league partners, demo dates) that dictate sequencing?
- Should we move off Render free tier to guarantee performance?
- What analytics or KPIs are required to prove value (onboarding completion rate, active events, ranking adjustments)?
- Who owns long-term compliance (COPPA, parental consent) and data retention policies?

---

### Quick Reference Links

- Production frontend: https://woo-combine.com  
- Production backend: https://woo-combine-backend.onrender.com  
- API docs: `docs/API_REFERENCE.md`, `docs/API_CONTRACT.md`  
- Deployment runbooks: `docs/guides/RENDER_DEPLOYMENT.md`, `docs/ENV_VARS_AND_RENDER_SETUP.md`  
- Security & legal: `docs/security/security-controls-checklist.md`, `docs/legal/compliance-checklist.md`  
- Historical audits: `docs/reports/` directory (multiple deep dives)

---

**Next Steps**: Use this document as the hub, attach a living backlog, and schedule a walkthrough covering live product, Render dashboards, and Firestore data model to align on priorities within the first week.


