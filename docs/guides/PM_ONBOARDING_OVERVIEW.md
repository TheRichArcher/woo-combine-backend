# WooCombine PM Handoff & Onboarding Guide

_Last updated: December 13, 2025_

This guide serves as the primary source of truth for the WooCombine product state, architecture, and operational procedures. It supersedes previous debugging guides and reflects the current **stable, production-ready** status of the application following the comprehensive December 2025 stabilization sprint.

---

## 1. 🟢 Executive Status: Production Ready

The application has graduated from "debugging/crisis" mode to a stable product.

- **Stability**: Critical infinite loops, race conditions (including login/league fetching), and temporal dead zones have been definitively resolved.
- **Quality**: Zero linting errors, clean build process, and no console log noise.
- **Observability**: Full Sentry integration (Frontend & Backend) for real-time error tracking and performance monitoring.
- **Import Reliability**: Robust CSV/Excel import engine now handles flat vs. nested data structures seamlessly, with optional jersey numbers and clear success stats.
- **Analytics**: Full data pipeline verified. Drill Explorer now supports deep analysis with scrollable vertical rankings for unlimited athletes.
- **Security**: Phone authentication and reCAPTCHA have been **completely removed** in favor of a robust, verified Email/Password flow.
- **UX**: Onboarding flows are fully guided. Team Formation and Live Standings now use advanced schema-driven logic.

---

## 2. 🏗 System Architecture

### Frontend (Client)
- **Tech**: React 18 + Vite + Tailwind CSS.
- **Auth**: Firebase Authentication (Email/Password only).
- **State Management**:
  - `AuthContext`: Handles user session, role checks, and league context. *Refactored to remove circular dependencies and infinite loops.*
  - `EventContext`: Minimalist context to avoid initialization race conditions.
  - `useOptimizedWeights`: **(New)** Centralized hook for weight management, ensuring 0-100 scale consistency across all views.
- **Data Access**: All data operations go through the backend API (`/api/v1`). **No direct Firestore writes from the frontend.**
- **Key Components**:
  - `Players.jsx`: The core workspace. Features tabbed interface, real-time weight sliders, and normalized ranking calculations.
  - `CoachDashboard.jsx`: **(Refactored)** Central command center. Now shares the **exact same ranking engine** as the Players page, supporting dynamic drill weights for any sport (not just Football). Includes "Events in this League" card.
  - `TeamFormation.jsx`: Advanced algorithmic team generation (Snake Draft vs. Balanced) based on weighted rankings.
  - `Analytics.jsx`: Visual data analysis with "Drill Explorer" charts. Reads from `player.scores` map.
  - `OnboardingEvent.jsx`: The "Wizard" for new organizers.
  - `ImportResultsModal.jsx`: The unified import interface with 2-step validation, schema mapping, and stats reporting.

### Backend (Server)
- **Tech**: FastAPI (Python) on Render.
- **Database**: Google Firestore (accessed via `firestore_client.py`).
- **Authentication**: Verifies Firebase ID tokens via Middleware.
- **Scaling**: Stateless architecture. Handles Render cold starts (45s timeout tolerance) via robust frontend retry logic.

---

## 3. 🔄 Critical User Journeys (Verified)

### A. New League Organizer (The "Cold Start" User)
1. **Signup**: Email/Password -> Auto-redirect to Verify Email.
2. **Verification**: User clicks link -> Page auto-refreshes -> Redirects to Dashboard.
3. **Setup**: Dashboard detects 0 leagues -> Shows "Start Guided Setup".
4. **Wizard**:
   - **Create League**: Sets up the organization.
   - **Onboarding Wizard**: Creates first event -> Shows QR Codes -> Guides Roster Upload -> Explains "Live Entry".
   - **Completion**: Ends with clear "What's Next" actionable steps (e.g., "Start Live Entry Mode").

### B. Invited Coach/Viewer (The "QR Code" User)
1. **Scan**: User scans role-specific QR code (Blue for Coach, Green for Viewer).
2. **Intent**: App captures `leagueId`, `eventId`, and `role` from URL.
3. **Auth**: User signs up or logs in.
4. **Role Enforcement**: `SelectRole` screen detects invitation and **locks** the role choice (e.g., a Viewer cannot choose Coach).
5. **Join**: Automatically adds user to league/event and redirects to `Players` page.

### C. Daily Operations (The "Power User")
- **Dashboard**: Smart routing checks `selectedLeagueId` and `selectedEvent`.
- **Switching**: Header dropdowns allow instant context switching.
- **Scoring**: "Live Entry" mode for rapid data input.
- **Analysis**: `Players` page with real-time weight sliders (Speed vs. Skills vs. Balanced).
- **Team Formation**: Generate balanced teams automatically using the new "Balanced" or "Ranked Split" algorithms.
- **Reporting**: Export professional PDF rankings and scorecards directly from the Players page.
- **Import**: Robust bulk import for offline results (CSV/Excel/Paste) with smart mapping and validation.

---

## 4. 🛠 Recent Major Upgrades (Dec 2025)

We have completed a massive cleanup and optimization sprint. Here is what changed:

### ⚖️ Ranking Consistency & Schema Support (New!)
- **Unified Ranking Engine**: Fixed a discrepancy where Coach Dashboard and Players page showed different scores. Both now utilize the same dynamic weight logic via `useOptimizedWeights`.
- **Dynamic Sport Support**: The Coach Dashboard no longer relies on hardcoded Football weights. It dynamically adapts to ANY sport schema (Basketball, Baseball, etc.) by reading the active event's drill configuration.
- **Weight Scaling**: Standardized all weight inputs to a 0-100 scale across the application to prevent calculation errors.

### 🧩 Team Formation & Algorithms
- **Skill-Based Generation**: Added a sophisticated Team Formation engine that uses player rankings to create balanced teams.
- **Ranked Split**: New mode to split the cohort by skill level (e.g., "Top 20" vs "Next 20") rather than balancing them mixed together.
- **Validation**: Added "Category Balance" checks to ensure teams aren't just score-balanced but also role-balanced (e.g., Guard/Forward distribution).

### 🏆 Live Standings & Rankings
- **Schema-Driven Engine**: Completely refactored Live Standings to use a dynamic backend schema engine. This fixes the "3 of 0 players" bug by ensuring all eligible players are counted, even those with partial data.
- **Dynamic Drills**: The standings table now adapts columns automatically based on the event's configured drills.
- **PDF Export**: Added one-click PDF generation for rankings and individual scorecards, replacing the need for external tools.

### 🛠 Custom Drill Builder
- **Full Customization**: Organizers can now create custom drills with specific types (Time, Count, Checkbox) and validation rules.
- **Event Scoping**: Custom drills are securely scoped to specific events to prevent library pollution.
- **Import Support**: The import engine automatically detects and maps custom drill headers.

### 🧠 Player Details UX
- **Universal Clickable Modals**: Clicking any player row (in Rankings, Team Formation, or Scorecards) now opens a consistent "Player Details" modal.
- **Inline Desktop Panel**: On large screens, player details open in a side panel for seamless browsing without losing context.
- **Zero-Impact Clarity**: Added explicit badges ("No impact", "Not included") to explain why a score contributes 0 points.

### 🔐 Authentication & Stability
- **Login Race Conditions**: Fixed a critical race condition where fetching leagues would fail on login, causing a false "No Leagues Found" state.
- **Sentry Integration**: Fully enabled Sentry for frontend and backend error tracking.
- **Removed Phone Auth & reCAPTCHA**: Simplified to standard Email/Password.
- **Role Security**: Fixed vulnerability where invited users could escalate privileges.

### 📥 Import Engine Overhaul
- **Score Extraction**: Fixed "0 scores imported" bug. Backend now robustly merges flat CSV keys with nested data structures.
- **Flexible Validation**: Made `jersey_number` optional and added smart synonym detection (`#`, `No`, `Jersey`).
- **Smart Mapping**: Frontend now warns (non-blocking) if data-bearing columns are ignored.

### 📊 Analytics & Data Integrity
- **Drill Explorer**: "All" view now supports unlimited athletes via virtualized scrolling.
- **Chart Stability**: Enforced strict numeric domains to eliminate rendering errors.
- **Data Sourcing**: Fixed Analytics to correctly read from `player.scores`.

---

## 5. 📊 Operational Guide

### Deployment Configuration (Critical)
The frontend is a Static Site on Render. **Strict adherence to these settings is required** to prevent caching issues and build failures:

- **Repository**: `woo-combine-backend` (Monorepo)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
  - ⚠️ **CRITICAL**: Do NOT set this to `frontend/dist`. Since the Root Directory is already `frontend`, Render looks for the Publish Directory *relative* to that.

### Caching Strategy
- **Vite Configuration**: `vite.config.js` is configured to append timestamps to output filenames (e.g., `assets/index-HASH-TIMESTAMP.js`).
- **Why**: This is a "nuclear option" to bust aggressive CDN caches on Render.

### Monitoring
- **Sentry**: Active in both Production and Staging.
  - **Frontend**: Captures React boundary errors and network failures.
  - **Backend**: Captures FastAPI exceptions and 500s.
- **Logs**: Check Render Dashboard for raw backend logs if Sentry detail is insufficient.

### Known Limitations
- **Render Cold Starts**: Free tier backend sleeps after 15m inactivity. First request takes ~45s.
  - *Mitigation*: Frontend shows "Server is starting..." toast.
- **Mobile Layout**: Optimized for standard phones, but complex tables (Rankings) are dense on small screens.

---

## 6. 🔮 Handoff & Next Steps

### Immediate Priorities
1. **Documentation**: Maintain this guide as the primary reference.
2. **Analytics**: Monitor Sentry for any new regression patterns.
3. **Scale**: Monitor Firestore read/write costs as user base grows.

### Key Files & Directories
```
frontend/src/
├── context/
│   ├── AuthContext.jsx          # Auth + league/event state
│   ├── EventContext.jsx         # Minimal event state
│   └── ToastContext.jsx         # UX notifications
├── hooks/
│   ├── useOptimizedWeights.js   # ⚖️ Central Ranking Engine (Scale 0-100)
│   └── useDrills.js             # 🛠 Drill Schema Fetching
├── pages/
│   ├── Home.jsx                 # Dashboard routing
│   ├── CoachDashboard.jsx       # Main organizer/coach view
│   ├── Players.jsx              # Core workspace
│   ├── TeamFormation.jsx        # Team generation algorithms
│   ├── Analytics.jsx            # Charts & Data Visualization
│   └── AdminTools.jsx           # Admin settings
└── components/
    └── Players/
        └── ImportResultsModal.jsx # Unified Import Interface

backend/
├── routes/
│   ├── users.py                 # User management
│   ├── leagues.py               # League logic
│   ├── events.py                # Event logic
│   ├── players.py               # Player & Scoring logic
│   └── imports.py               # Import parsing & schema mapping
└── main.py                      # App entry point
```

---

## 7. ❓ Product Context & FAQ

This section answers common PM questions based on the current codebase state.

### 💼 Business & Pricing
- **Single Product**: WooCombine is a **single product** with "Dynamic Sport Support". It adapts to any sport schema (Basketball, Baseball, etc.) without needing separate SKUs.
- **Pricing Model**: There is currently **no code-level enforcement** of pricing, subscriptions, or "Pro" tiers. All features appear available to all users.
- **Billing**: No integration with Stripe or other payment providers exists in the repo.

### 🚀 Environments & Release
- **Environments**:
  - **Dev**: Auto-deploys from `main` on every push.
  - **Staging**: Manual deploy from protected branch. Requires QA sign-off.
  - **Prod**: Deployed via git tags (`vX.Y.Z`).
- **Release Process**: Fully documented in `docs/RELEASE_FLOW.md`. Requires changelog updates and health checks.

### 💾 Data & Models
- **Legacy Fields**: Fields like `drill_40m_dash` are deprecated but automatically synced to the new dynamic `scores` map for backward compatibility.
- **Multi-sport Athletes**: Players are scoped to an **Event** (`event_id`), meaning a player participating in multiple events will have duplicated records.
- **Deletion**: Hard deletes are supported; no soft-delete (`deleted_at`) column exists in core schemas.

### 🛠 Tech & Tooling
- **Design System**: Built on **Tailwind CSS**. No external UI component library.
- **Import Engine**: Supports CSV/Excel. Handles flat vs. nested JSON structures and includes "smart synonym" matching for headers (e.g., `#` = `Jersey`).
- **CI/CD**: Enforces Linting (Ruff/ESLint), Formatting (Black), Security Audits (pip-audit), and Tests (pytest/jest) on every PR.
- **Shared Accounts**: The team shares access to **Render** (Hosting), **Sentry** (Observability), and **Firebase** (Auth/DB).

---

## 8. 🗣️ PM FAQ (Follow-Up)

Answers to the specific process & business questions from the incoming PM.

### 1) Product Vision & Roadmap
- **Goals/Vision**: No formal "vision statement" or written roadmap exists in the codebase.
- **Dates**: No hard dates (tournaments, pilots) are hardcoded or documented.
- **Seasonality**: No seasonal logic found.

### 2) Customers & Usage
- **Active Users**: Customer counts and specific "flagship" names are not in the repo (check production DB/Analytics).
- **Patterns**: No specific usage patterns documented.

### 3) Pricing & Entitlements
- **Current State**: **Zero enforcement** in code. No Stripe, no subscription checks, no "Pro" gates.
- **Plan**: No upcoming pricing changes reflected in current architectural decisions.

### 4) Data Lifecycle
- **Retention**:
  - **Leagues/Events**: Retained indefinitely until user deletion request; inactive projects purged after 24 months (configurable).
  - **Player Data**: Retained 24 months after event end.
- **Recoverability**: JSON exports are available upon verified request (DSR process).
- **Ref**: `docs/legal/data-retention-and-dsr.md`

### 5) Permissions & Security
- **Super Admin**: **None**. The role matrix (`backend/security/access_matrix.py`) only defines `organizer`, `coach`, and `viewer`. There is no "god mode" role in the backend code.
- **Security Gaps**: No critical `FIXME` or `TODO` markers related to security were found.

### 6) Testing & QA
- **Confidence**: Automated tests exist but the workflow relies heavily on **manual testing**, specifically for UI interactions like Sliders (`docs/guides/DEBUG_TESTING_GUIDE.md`).
- **QA Process**: "QA sign-off" on Staging is a required step in the release flow, but appears to be a manual team process, not an automated gate.

### 7) Observability
- **Sentry**: Primary tool for errors.
- **Playbook**: Runbooks exist for `Firestore-Quota-Exceeded` and `Credential-Outage` in `docs/runbooks/`.

### 8) Tech Debt & "Sharp Edges"
- **AuthContext.jsx**: ⚠️ **High Risk**. This file (`frontend/src/context/AuthContext.jsx`) contains multiple "CRITICAL FIX" patches for race conditions, infinite loops, and cold starts. Touch with extreme caution.
- **Render Cold Starts**: The backend's lazy initialization pattern (`backend/main.py`) is optimized but adds complexity to the startup flow.

### 9) Design & UX
- **Design System**: Strict **Tailwind CSS**. No other component library.
- **Decisions**: UX decisions seem engineering-driven based on the "functional" nature of the docs.

### 10) Feedback & Access
- **Feedback**: No in-app feedback collection code found.
- **Access**: PMs need access to **Render**, **Sentry**, and **Firebase Console**.

---

### 10. Known Issues & Guardrails

### ⚠️ Event Creation Stability
A "white screen" crash was identified in the "Create New Event" flow due to undeclared `loading`/`error` states in the component. This has been fixed, but serves as a reminder to check all form components for robust state handling.

- **Incident Report**: `docs/reports/SCHEMA_401_INVESTIGATION.md`
- **Manual QA Checklist**: `docs/qa/MANUAL_CHECKLIST.md`

### ⚠️ Auth Context & Schema 401s
The app occasionally logs 401 Unauthorized errors on the `/schema` endpoint. This is due to `selectedEvent` persisting in local storage across league switches. It is benign (fallback exists) but is tracked as technical debt.

### ✅ Stable Features (Dec 2025)
- **Create New Event**: Fixed white screen crash.
- **Import Mapping**: Added column synonyms and strict validation.
- **Balanced Team Formation**: New robust algorithm handles scored/unscored players fairly.
- **Player Edit**: API-first optimistic updates ensure data consistency without refresh.

### 🔮 Upcoming Stability Sprint
- **AuthContext Refactor (Milestone 2)**: Migrating auth logic to a deterministic State Machine to prevent race conditions.
- **Cross-View Consistency**: Ensuring player edits reflect instantly across all dashboard views.

---

## 9. 💡 Recommendations for Incoming PM

Based on the current codebase state, here are the recommended "Day 1" priorities:

### 1. 🗺️ Lock in a "Critical Areas" Map
- **Status**: `AuthContext.jsx` is the first confirmed high-risk module.
- **Action**: Treat any ticket touching auth, loading states, or session persistence as high-risk. Require a scoped plan before coding begins.

### 2. ✅ Establish a Lightweight QA Checklist
- **Context**: Automated tests are thin for UI flows.
- **Action**: Create a manual regression checklist for Staging covering:
  - Login/Auth flows (including "Cold Start" delays)
  - Player Import (CSV/Excel)
  - Live Standings & Scoring
  - Event Creation & Sharing

### 3. 📜 Formalize Data Retention Messaging
- **Context**: Policy exists (24 months) but is not visible to users.
- **Action**: Add a "Data Expiry" note in Settings or Help to manage expectations.

### 4. 💰 Define Monetization Before Roadmap
- **Context**: No billing infra exists. Adding it is net-new work, not a toggle.
- **Action**: Decide if WooCombine is free for now. If paid features are planned, prioritize billing infrastructure early to avoid architectural dead-ends.

### 5. 🏗️ Evaluate AuthContext Refactor
- **Context**: The file is fragile (`CRITICAL FIX` comments).
- **Action**: Either schedule a dedicated refactor sprint in Q1 or strictly freeze changes to this module until unavoidable.
