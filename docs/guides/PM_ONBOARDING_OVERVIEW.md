# WooCombine PM Handoff & Onboarding Guide

_Last updated: December 18, 2025_

This guide serves as the primary source of truth for the WooCombine product state, architecture, and operational procedures. It supersedes previous debugging guides and reflects the current **stable, production-ready** status of the application following the comprehensive December 2025 stabilization sprint.

---

## 1. 🟢 Executive Status: Production Ready

The application has graduated from "debugging/crisis" mode to a stable product.

- **Stability**: Critical infinite loops, race conditions (including login/league fetching), and temporal dead zones have been definitively resolved.
- **Ranking Accuracy**: The ranking system has been audited and unified. Backend and frontend now use the exact same **Renormalized Weighted Average** formula, ensuring scores match perfectly across the stack. Schema min/max ranges are consistent.
- **Boot Experience**: Multi-route flicker on login has been eliminated via a new `BootGate` architecture. Auth/context hydration is now smooth and deterministic.
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
  - `useOptimizedWeights` & `usePlayerRankings`: **(Unified)** Centralized hooks for weight management, ensuring 0-100 scale consistency across all views using Renormalized Weighted Average.
- **Boot Process**:
  - `BootGate.jsx`: **(New)** A gating component that blocks the router from rendering until Auth, Role, League, and Event contexts are fully resolved. Eliminates "flash of unstyled content" and multi-page flicker.
  - `LoadingScreen.jsx`: Standardized loading component used globally.
- **Data Access**: All data operations go through the backend API (`/api/v1`). **No direct Firestore writes from the frontend.**
- **Key Components**:
  - `Players.jsx`: The core workspace. Features tabbed interface, real-time weight sliders, and normalized ranking calculations.
  - `CoachDashboard.jsx`: **(Refactored)** Central command center. Uses a `playersLoading` gate to prevent the "Import Players" empty state from flashing during data fetch.
  - `TeamFormation.jsx`: Advanced algorithmic team generation (Snake Draft vs. Balanced) based on weighted rankings.
  - `Analytics.jsx`: Visual data analysis with "Drill Explorer" charts. Reads from `player.scores` map.
  - `OnboardingEvent.jsx`: The "Wizard" for new organizers.
  - `ImportResultsModal.jsx`: The unified import interface with 2-step validation, schema mapping, and stats reporting.

### Backend (Server)
- **Tech**: FastAPI (Python) on Render.
- **Database**: Google Firestore (accessed via `firestore_client.py`).
- **Authentication**: Verifies Firebase ID tokens via Middleware.
- **Ranking Engine**: **(Unified)** `calculate_composite_score` now uses Renormalized Weighted Average. Handles both decimal (0.2) and percent (20) weights robustly. Renormalizes scores to 100 even if drills are disabled.
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
- **Management**: **(New)** Full event editing capabilities (Name, Date, Location, Notes) without data loss or ranking disruption.
- **Switching**: Header dropdowns allow instant context switching.
- **Scoring**: "Live Entry" mode for rapid data input.
- **Analysis**: `Players` page with real-time weight sliders (Speed vs. Skills vs. Balanced).
- **Team Formation**: Generate balanced teams automatically using the new "Balanced" or "Ranked Split" algorithms.
- **Reporting**: Export professional PDF rankings and scorecards directly from the Players page.
- **Import**: Robust bulk import for offline results (CSV/Excel/Paste) with smart mapping and validation.

---

## 4. 🛠 Recent Major Upgrades (Dec 2025)

We have completed a massive cleanup and optimization sprint. Here is what changed:

### 📊 Ranking System Unification (New!)
- **Consistency**: Backend API and Frontend UI now use the exact same formula (Renormalized Weighted Average).
- **Accuracy**: Weights can be entered as decimals (0.2) or percents (20) without issues. System robustly handles unit differences.
- **Renormalization**: If an event disables drills (e.g. only 3 active drills), the system renormalizes the score to a 0-100 scale, so "perfect" is always 100.
- **Schema**: Standardized Min/Max ranges for Basketball (Vertical Jump 0-50, Lane Agility 8-20) across both backend and frontend to prevent initial load mismatches.

### 🚦 Boot & Navigation Stability
- **BootGate Implementation**: Added a global `BootGate` component to `App.jsx`. This acts as a circuit breaker, preventing the router from loading ANY page (Login, Dashboard, etc.) until the application state (`IDLE`, `INITIALIZING`, `AUTHENTICATING`, `READY`) is stable.
- **Route Guards**: `RequireAuth` and `RequireLeague` wrappers now check specific context flags before rendering, redirecting cleanly if needed.
- **Zero-Flicker Login**: Removed the jarring "Welcome -> Login -> Dashboard" flicker. Users see a clean loading spinner until destination is resolved.

### 🧹 Codebase Cleanup
- **Dead Code**: Removed ~2,500 lines of unused code, including old phone auth, `quickAuthCheck`, circular dependencies, and duplicate ranking logic.
- **Linting**: Achieved **Zero Lint Errors**. Codebase is strict compliant.
- **Imports**: Fixed all relative import paths and unused imports.
- **Console Noise**: Removed verbose debug logging (emoji logs) from production builds.

### 📝 Event Management (New!)
- **Full Editing**: Organizers can now edit Event Name, Date, Location, and Notes after creation.
- **Safety**: Updates rely on immutable IDs, ensuring QR codes, player data, and rankings remain intact.
- **UX**: Added "Notes" field to both setup and edit screens for better event context.

---

## 5. 🔍 Key Files Map

For the new PM/Dev, these are the files you will touch most often:

```text
frontend/
├── src/
│   ├── App.jsx                  # 🚦 BootGate & Routing Definition
│   ├── main.jsx                 # Context Providers Setup
│   ├── context/
│   │   ├── AuthContext.jsx      # 🔐 Session & League Logic
│   │   ├── EventContext.jsx     # 📅 Event Selection Logic
│   │   └── ToastContext.jsx     # 🔔 Notification System
│   ├── hooks/
│   │   ├── usePlayerRankings.js # ⚖️ Live Ranking Calculation (Unified)
│   │   └── useDrills.js         # 🛠 Drill Schema Fetching
│   ├── pages/
│   │   ├── Home.jsx             # Dashboard routing
│   │   ├── CoachDashboard.jsx   # Main organizer/coach view
│   │   ├── Players.jsx          # Core workspace
│   │   ├── TeamFormation.jsx    # Team generation algorithms
│   │   ├── Analytics.jsx        # Charts & Data Visualization
│   │   └── AdminTools.jsx       # Admin settings
│   └── components/
│       └── Players/
│           └── ImportResultsModal.jsx # Unified Import Interface
│   └── utils/
│       ├── rankingUtils.js      # Static Ranking Logic (Unified)
│       └── optimizedScoring.js  # Performance Optimized Scoring (Unified)

backend/
├── routes/
│   ├── users.py                 # User management
│   ├── leagues.py               # League logic
│   ├── events.py                # Event logic
│   ├── players.py               # Player & Scoring logic (Unified Formula)
│   └── imports.py               # Import parsing & schema mapping
├── services/
│   └── schema_registry.py       # 📋 Drill Templates & Defaults
└── main.py                      # App entry point
```

---

## 6. ❓ Product Context & FAQ

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

## 7. 🗣️ PM FAQ (Follow-Up)

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
