# WooCombine PM Handoff & Onboarding Guide

_Last updated: January 2, 2026_

This guide serves as the primary source of truth for the WooCombine product state, architecture, and operational procedures. It supersedes previous debugging guides and reflects the current **stable, production-ready** status of the application following comprehensive stabilization and product definition sprints through January 2026.

---

## 1. 🟢 Executive Status: Production Ready

The application has graduated from "debugging/crisis" mode to a stable, focused product with clear architectural boundaries.

- **Stability**: Critical infinite loops, race conditions (including login/league fetching), and temporal dead zones have been definitively resolved.
- **Ranking Accuracy**: The ranking system is **definitively verified** via "Golden Ranking" tests. Both Backend and Frontend scoring engines calculate identical scores (accurate to 2 decimal places) using the Renormalized Weighted Average formula.
- **Boot Experience**: Multi-route flicker on login has been eliminated via `BootGate` architecture. Auth/context hydration is now smooth and deterministic.
- **Quality**: Zero linting errors, clean build process. CI pipeline resilient with graceful degradation for optional dependencies.
- **Observability**: Full Sentry integration (Frontend & Backend) for real-time error tracking and performance monitoring.
- **Import Reliability**: Robust CSV/Excel import engine handles flat vs. nested data structures seamlessly, with optional jersey numbers and clear success stats.
- **Security**: Email/Password authentication with proper verification flows. Phone auth and reCAPTCHA fully removed.
- **UX**: Guided onboarding flows, contextual navigation, and clear next-action CTAs eliminate "what do I do next?" friction.
- **Product Discipline**: Clear architectural boundaries documented. Features organized by the 10-second rule for operational focus.

---

## 2. 🏗 System Architecture

### Frontend (Client)
- **Tech**: React 18 + Vite + Tailwind CSS
- **Auth**: Firebase Authentication (Email/Password only)
- **State Management**:
  - `AuthContext`: User session, role checks, league context. Refactored to eliminate circular dependencies and infinite loops.
  - `EventContext`: Minimalist context to avoid initialization race conditions.
  - `useOptimizedWeights` & `usePlayerRankings`: Centralized hooks for weight management, ensuring 0-100 scale consistency using Renormalized Weighted Average.
- **Boot Process**:
  - `BootGate.jsx`: Gating component that blocks router until Auth, Role, League, and Event contexts are fully resolved. Eliminates flash of unstyled content.
  - `LoadingScreen.jsx`: Standardized loading component used globally.
- **Data Access**: All data operations through backend API (`/api/v1`). **No direct Firestore writes from frontend.**
- **Key Components**:
  - `CoachDashboard.jsx`: **Command center** for organizers + coaches. Shared ops dashboard with role-based controls. See §8 for detailed scope.
  - `Players.jsx`: Core workspace with tabbed interface, player management, and rankings.
  - `TeamFormation.jsx`: Algorithmic team generation (Snake Draft vs. Balanced) based on weighted rankings.
  - `Analytics.jsx`: Visual data analysis with "Drill Explorer" charts. Deep analysis tools.
  - `OnboardingEvent.jsx`: Guided wizard for new organizers.
  - `ImportResultsModal.jsx`: Unified import interface with 2-step validation and schema mapping.

### Backend (Server)
- **Tech**: FastAPI (Python) on Render
- **Database**: Google Firestore (accessed via `firestore_client.py`)
- **Authentication**: Verifies Firebase ID tokens via Middleware
- **Ranking Engine**: `calculate_composite_score` uses Renormalized Weighted Average. Handles both decimal (0.2) and percent (20) weights robustly.
- **PDF Generation**: Optional `reportlab` integration. Gracefully degrades if library missing.
- **Scaling**: Stateless architecture. Handles Render cold starts (45s timeout tolerance) via robust frontend retry logic.

---

## 3. 🧭 Product Architecture & Philosophy

### Role-Based Access Model

**Key Principle:** Organizer = Superset of Coach

```
Roles Hierarchy:
├─ Organizer (Full Access)
│  ├─ All Coach permissions
│  ├─ Event management (create/edit)
│  ├─ Player management (add/remove)
│  ├─ Ranking weight controls
│  └─ Admin tools
│
├─ Coach (Limited Access)
│  ├─ View players & rankings
│  ├─ Export data
│  ├─ Scoring/evaluations
│  └─ Team formation
│
└─ Viewer (Read-Only)
   └─ View rankings only
```

**Implementation:** Both organizers and coaches use the **same pages** with role-based controls (buttons/features show/hide based on role).

---

### Navigation Architecture (LOCKED ✅)

**Status:** Validated and locked as optimal (Jan 2, 2026)

**Guiding Principle: The 10-Second Rule**
> "Can an organizer make this decision in under 10 seconds while standing at the registration table during an event?"
> 
> **YES** → Belongs on `/coach`  
> **NO** → Move to specialist page

#### Page Hierarchy

```
WooCombine App
│
├─ /coach (Command Center) ⭐
│  ├─ Run the event (status + next actions)
│  ├─ Make fast operational decisions
│  └─ Navigate to specialist tools
│
├─ /players (Roster Operations)
│  ├─ Player management (add/edit/delete)
│  ├─ Bulk operations (CSV import/export)
│  └─ Full rankings explorer
│
├─ /analytics (Analysis & Optimization)
│  ├─ Ranking weight tuning (detailed sliders)
│  ├─ Performance insights
│  └─ Historical trends
│
├─ /schedule (Calendar Management)
│  └─ Event scheduling & planning
│
├─ /scorecards (Player Reports)
│  └─ Individual player scorecards
│
└─ /team-formation (Team Building)
   └─ Balanced team creation
```

**Navigation from `/coach` (5 Persistent Links):**
1. **Players** - Roster ops, imports, rankings, exports
2. **Schedule** - Event timing & logistics
3. **Teams** - Post-evaluation team formation
4. **Scorecards** - Individual player reports
5. **Analytics** - Deep analysis & weight tuning

**Rationale:** These 5 answer "I need to act now" or "I need to go deeper" - the only valid reasons to leave `/coach`.

**DO NOT ADD** new persistent nav items unless they clearly pass the 10-second rule and cannot be better served by contextual CTA.

---

## 4. 🔄 Critical User Journeys (Verified)

### A. New League Organizer (The "Cold Start" User)
1. **Signup**: Email/Password → Auto-redirect to Verify Email
   - Clear success message: "Account Created! Check Your Email"
   - Shows user's email address
   - Auto-redirects to verify-email page after 1.5s
2. **Verification**: 
   - User clicks link in email
   - Page auto-refreshes every 10 seconds
   - Auto-redirects to dashboard when verified
3. **Role Selection**: 
   - Selects "League Operator" role
   - Direct path (no invitation requirements removed)
4. **Setup**: 
   - Dashboard detects 0 leagues → Shows "Start Guided Setup"
   - Create League → Auto-navigates to event creation
5. **Wizard**:
   - **Onboarding Event**: Creates first event → Shows QR Codes → Guides Roster Upload → Explains "Live Entry"
   - **Completion**: Clear "What's Next" actionable steps (View QR Codes, Manage Players, Start Live Entry, Export Results)

### B. Invited Coach/Viewer (The "QR Code" User)
1. **Scan**: User scans role-specific QR code (Blue for Coach, Green for Viewer)
2. **Intent**: App captures `leagueId`, `eventId`, and `role` from URL
3. **Auth**: User signs up or logs in (redirects to /signup since invitees are typically new users)
4. **Role Enforcement**: `SelectRole` screen detects invitation and **locks** the role choice (e.g., a Viewer cannot escalate to Coach or Organizer)
5. **Join**: Automatically adds user to league/event and redirects to appropriate page

### C. Daily Operations (The "Power User")
1. **Landing**: Organizers/Coaches auto-redirect to `/coach` (command center)
2. **Navigation Labels**:
   - Organizers see: "Event Dashboard"
   - Coaches see: "Coach Dashboard"
   - Viewers see: "Home"
3. **Next Action CTA**: Smart contextual button shows:
   - No players → "Add Players"
   - Players, no scores → "Import Results" + "Start Live Entry"
   - Partial scores → "Continue Evaluations" (with progress %)
   - Complete → "Review Full Rankings" + "Export Results"
4. **Event Management**: 
   - Edit Event button visible in top Events Card
   - Update name, date, location without data loss
5. **Switching**: Header dropdowns allow instant context switching
6. **Scoring**: "Live Entry" mode for rapid data input
7. **Analysis**: Weight presets for quick ranking adjustments (preset count varies by sport: Football/Basketball have 4, Baseball/Soccer have 2, Track/Volleyball have 1)
8. **Team Formation**: Generate balanced teams automatically
9. **Reporting**: Export CSV rankings directly from dashboard
10. **Import**: Robust bulk import for offline results

---

## 5. 🛠 Recent Major Changes (Jan 2026)

### 🎯 Ranking Preset Model (Locked & Final)
**What Changed:** (Jan 2, 2026)
- Synced frontend presets with backend schema registry across all 6 sports
- Basketball: Added 3 missing presets (Balanced, Athleticism, Skill Focus) - was 1, now 4
- Baseball: Added missing Balanced preset - was 1, now 2
- Created `PRESET_MODEL_FINAL.md` documenting intentional preset design philosophy
- Locked preset model as "no new presets without product review"

**Philosophy:**
- Presets are fast operational shortcuts, not exhaustive tuning tools
- Preset count varies by sport complexity:
  - Football/Basketball → 4 presets (multi-position sports)
  - Baseball/Soccer → 2 presets (clear role differentiation)
  - Track/Volleyball → 1 preset (highly specialized)
- Deep weight tuning belongs in `/analytics`, not preset buttons

**Impact:**
- ✅ All sports have consistent frontend ↔ backend preset exposure
- ✅ Prevents preset bloat (max 4 even for complex sports)
- ✅ Clear design rationale for "why this many presets?"
- ✅ Basketball and Baseball users now see full preset options

**Files:**
- `PRESET_MODEL_FINAL.md` (Complete preset documentation)
- `backend/services/schema_registry.py` (Source of truth)
- `frontend/src/constants/drillTemplates.js` (Synced mirror)

---

### 🎯 Product Scope Definition & Navigation Lock
**What Changed:**
- Created `docs/product/COACH_DASHBOARD_SCOPE.md` as canonical reference for `/coach` feature decisions
- Established the **10-second rule** as design principle
- Validated and locked `/coach` navigation architecture (5 persistent links + contextual CTA)
- Defined clear boundaries: /coach = operations, /analytics = deep analysis, /players = roster work

**Impact:**
- ✅ Clear mental model for feature decisions
- ✅ Prevents "everything dashboard" syndrome
- ✅ Establishes scalable architecture
- ✅ Documentation serves as arbiter for "should this live on /coach?" questions

**Files:**
- `docs/product/COACH_DASHBOARD_SCOPE.md` (Product spec)
- `frontend/src/pages/CoachDashboard.jsx` (Implementation)

---

### 🎯 Contextual Next Action CTA
**What Changed:**
- Added smart primary action button on `/coach` that adapts to event state
- Four states: No players / Ready to score / In progress / Complete
- Each state shows appropriate action with icon, label, and progress info
- Secondary actions available when relevant (e.g., "Start Live Entry" when ready to score)

**Impact:**
- ✅ Eliminates "what do I do next?" friction
- ✅ Provides clear operational guidance at every event stage
- ✅ Reduces time to first action
- ✅ Contextual help is better than static instructions

**States:**
1. **No Players** (Blue): "Add Players" → `/admin#player-upload`
2. **Ready to Score** (Green): "Import Results" → `/players?action=import` + Secondary "Start Live Entry"
3. **In Progress** (Orange): "Continue Evaluations" → `/live-entry` (shows completion %)
4. **Complete** (Teal): "Review Full Rankings" → `/players?tab=rankings` + Secondary "Export Results"

---

### 🎨 Role-Based Navigation Labels
**What Changed:**
- Navigation now shows role-specific labels instead of generic "Home"
- Organizers see: "Event Dashboard"
- Coaches see: "Coach Dashboard"
- Viewers/Players see: "Home"

**Impact:**
- ✅ Labels match what users see on actual pages
- ✅ Clearer user orientation
- ✅ Reinforces role-based mental model

**Files:**
- `frontend/src/components/Navigation.jsx` (Desktop + mobile nav)

---

### 📅 Event Date Handling Fix
**What Changed:**
- Fixed "Invalid Date" display issue caused by empty string dates
- Now sends `null` instead of `""` when date field is empty
- Better error messages: "Date not set" instead of "Invalid Date"

**Impact:**
- ✅ Cleaner UX for events without dates
- ✅ Proper null handling in database
- ✅ Fixed date parsing edge cases

**Files:**
- `frontend/src/components/EventSelector.jsx`
- `frontend/src/components/CreateEventModal.jsx`
- `frontend/src/components/EditEventModal.jsx`
- `frontend/src/pages/CoachDashboard.jsx`
- `frontend/src/components/EventSetup.jsx`

---

### ✏️ Edit Event Accessibility
**What Changed:**
- Added "Edit Event Details" button to top Events Card on `/coach` dashboard
- Previously only accessible via `/admin` → Event Setup (3 clicks away)
- Now visible immediately for organizers at top of page

**Impact:**
- ✅ Faster event management
- ✅ No navigation required to update event details
- ✅ Improved organizer workflow

**Files:**
- `frontend/src/pages/CoachDashboard.jsx`

---

### 📊 Ranking System Unification (Dec 2025)
- **Consistency**: Backend API and Frontend UI use exact same formula (Renormalized Weighted Average)
- **Accuracy**: Weights can be entered as decimals (0.2) or percents (20) without issues
- **Renormalization**: If event disables drills, system renormalizes score to 0-100 scale
- **Schema**: Standardized Min/Max ranges across backend and frontend

---

### 🚦 Boot & Navigation Stability (Dec 2025)
- **BootGate Implementation**: Global circuit breaker prevents router loading until app state is stable
- **Route Guards**: `RequireAuth` and `RequireLeague` check context flags before rendering
- **Zero-Flicker Login**: Clean loading spinner until destination resolved

---

### 🧹 Codebase Cleanup (Dec 2025)
- **Dead Code**: Removed ~2,500 lines of unused code
- **Linting**: Achieved Zero Lint Errors
- **Imports**: Fixed all relative import paths and unused imports
- **Console Noise**: Removed verbose debug logging from production

---

## 6. 🔍 Key Files Map

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
│   │   ├── usePlayerRankings.js # ⚖️ Live Ranking Calculation
│   │   └── useDrills.js         # 🛠 Drill Schema Fetching
│   ├── pages/
│   │   ├── Home.jsx             # Dashboard routing logic
│   │   ├── CoachDashboard.jsx   # ⭐ Command center (organizer + coach)
│   │   ├── Players.jsx          # Roster operations workspace
│   │   ├── TeamFormation.jsx    # Team generation algorithms
│   │   ├── Analytics.jsx        # Deep analysis & charts
│   │   ├── AdminTools.jsx       # Admin settings
│   │   ├── OnboardingEvent.jsx  # Guided wizard
│   │   └── SelectRole.jsx       # Role selection
│   ├── components/
│   │   ├── Navigation.jsx       # Global nav with role-based labels
│   │   ├── EventSelector.jsx    # Event dropdown & creation
│   │   ├── EditEventModal.jsx   # Event editing interface
│   │   └── Players/
│   │       └── ImportResultsModal.jsx # Unified import
│   └── utils/
│       ├── rankingUtils.js      # Static ranking logic
│       └── optimizedScoring.js  # Performance optimized scoring

backend/
├── routes/
│   ├── users.py                 # User management
│   ├── leagues.py               # League logic
│   ├── events.py                # Event CRUD operations
│   ├── players.py               # Player & Scoring logic
│   └── imports.py               # Import parsing & schema mapping
├── services/
│   └── schema_registry.py       # 📋 Drill Templates & Defaults
├── security/
│   └── access_matrix.py         # 🔒 Role-based permissions
└── main.py                      # App entry point

docs/
├── product/
│   └── COACH_DASHBOARD_SCOPE.md # ⭐ Product scope spec (READ THIS)
├── guides/
│   └── PM_ONBOARDING_OVERVIEW.md # This file
└── README.md                     # Technical overview
```

---

## 7. ❓ Product Context & FAQ

### 💼 Business & Pricing
- **Single Product**: WooCombine is a single product with "Dynamic Sport Support" (adapts to any sport schema)
- **Pricing Model**: Currently **no code-level enforcement** of pricing, subscriptions, or "Pro" tiers
- **Billing**: No integration with Stripe or payment providers exists in repo

### 🚀 Environments & Release
- **Environments**:
  - **Dev**: Auto-deploys from `main` on every push
  - **Staging**: Manual deploy from protected branch. Requires QA sign-off
  - **Prod**: Deployed via git tags (`vX.Y.Z`)
- **Release Process**: Fully documented in `docs/RELEASE_FLOW.md`

### 💾 Data & Models
- **Legacy Fields**: Fields like `drill_40m_dash` deprecated but auto-synced to `scores` map for backward compatibility
- **Multi-sport Athletes**: Players scoped to Event (`event_id`), meaning same person in multiple events = duplicate records
- **Deletion**: Hard deletes supported; no soft-delete column exists

### 🛠 Tech & Tooling
- **Design System**: Tailwind CSS. No external UI component library
- **Import Engine**: Supports CSV/Excel. Handles flat vs. nested JSON with smart synonym matching
- **CI/CD**:
  - **Backend**: Strict checks (Linting, Formatting, Security Audits, Tests)
  - **Frontend**: Linting and Build enforced. Unit tests run but non-blocking
- **Shared Accounts**: Team shares access to Render (Hosting), Sentry (Observability), Firebase (Auth/DB)

---

## 8. 🎯 /coach Dashboard: The Command Center

**Purpose:** Shared operations dashboard for organizers + coaches to run combine events

**Mental Model:** Can an organizer use this in under 10 seconds while running an event?

### What Lives on /coach (Confirmed Scope)

✅ **Event Management**
- League name display
- Event selector dropdown
- Create New Event button
- Edit Event Details button (organizers)
- Current event display

✅ **Contextual Next Action CTA**
- Smart button adapts to event state (no players / ready to score / in progress / complete)
- Primary + secondary actions when relevant

✅ **Quick Navigation Grid** (5 persistent links)
- Players, Schedule, Teams, Scorecards, Analytics

✅ **Age Group Selection**
- Dropdown with player counts
- "All Players" option for cross-age evaluation

✅ **High-Level Statistics**
- Player count, completion %, average score
- Score range (min/max)
- Status indicator (not started / in progress / complete)

✅ **Ranking Presets** (Organizers)
- 4 quick buttons for Football: Balanced / Speed / Skills / Athletic
- Basketball: 4 presets (Balanced / Shooter / Athleticism / Skill Focus)
- Baseball: 2 presets (Balanced / Hitter)
- Soccer: 2 presets (Balanced / Technical)
- Track: 1 preset (Sprinter Focus)
- Volleyball: 1 preset (Hitter Focus)
- Fast operational decision, not deep tuning
- Preset count scales with sport complexity

✅ **Rankings Preview**
- Top 8-10 players (at-a-glance signal)
- Export CSV button

### What Does NOT Live on /coach (By Design)

❌ **Full Weight Sliders** → Move to `/analytics` (deep tuning requires analysis)  
❌ **Deep Rankings Explorer** → Keep in `/players` (full sortable list, heavy modals)  
❌ **Drill-Level Breakdowns** → Belongs in `/analytics` (per-drill analysis)  
❌ **Historical Trends** → Belongs in `/analytics` (performance over time)  
❌ **Player Management** → Belongs in `/players` (add/edit/delete)  
❌ **Heavy Configuration** → Belongs in `/admin` (drill customization)

**Philosophy:** `/coach` stays fast, focused, operational. Average session time goal: <2 minutes (it's a command center, not a destination).

### Decision Framework

When someone requests a new feature on `/coach`, ask:

1. ✅ Is it needed within 10 seconds during event execution?
2. ✅ Is it an operational decision, not analytical deep-dive?
3. ✅ Can it be done in 1-2 clicks/inputs?
4. ✅ Does it provide at-a-glance status signal?
5. ✅ Can it better be served by contextual CTA?

**If NO to any:** Feature belongs on specialist page, not `/coach`.

**Reference:** See `docs/product/COACH_DASHBOARD_SCOPE.md` for full specification.

---

## 9. 🗣️ PM FAQ (Detailed)

### 1) Product Vision & Roadmap
- **Goals/Vision**: No formal vision statement in codebase. Product focuses on youth sports combine management with emphasis on operational speed and ease of use.
- **Dates**: No hard dates (tournaments, pilots) hardcoded
- **Seasonality**: No seasonal logic found

### 2) Customers & Usage
- **Active Users**: Customer counts not in repo (check production DB/Analytics)
- **Patterns**: Usage optimized for event-day operations (fast decisions, quick data entry)

### 3) Pricing & Entitlements
- **Current State**: **Zero enforcement** in code
- **Plan**: No upcoming pricing changes reflected in architecture

### 4) Data Lifecycle
- **Retention**:
  - **Leagues/Events**: Retained indefinitely until user deletion; inactive projects purged after 24 months
  - **Player Data**: Retained 24 months after event end
- **Recoverability**: JSON exports available via verified DSR request

### 5) Architecture Philosophy
- **Role Model**: Organizer = superset of coach (same pages, different controls)
- **Navigation**: 10-second rule determines feature placement
- **Page Hierarchy**: Command center (`/coach`) → Specialist pages (players/analytics/etc.)
- **Feature Scope**: Operational speed > Analytical depth on command center

---

## 10. 🚨 Common Pitfalls for New PMs

### ❌ Don't Do This:
1. **Add features to /coach without 10-second test** → Leads to bloat
2. **Create separate pages for organizer vs coach** → Violates superset model
3. **Add permanent nav links for infrequent actions** → Use contextual CTA
4. **Build deep analysis on /coach** → Belongs in /analytics
5. **Assume pricing/subscriptions exist** → No code enforcement currently

### ✅ Do This Instead:
1. **Check scope doc before adding to /coach** → `docs/product/COACH_DASHBOARD_SCOPE.md`
2. **Use role-based controls on shared pages** → Maintain superset model
3. **Leverage Next Action CTA for context** → Better than static nav
4. **Keep /coach fast and focused** → Deep work belongs elsewhere
5. **Document pricing requirements separately** → Requires architectural decision

---

## 11. 📚 Essential Reading for New PMs

**Start Here (Read in Order):**
1. This document (PM_ONBOARDING_OVERVIEW.md) - Overall product context
2. `docs/product/COACH_DASHBOARD_SCOPE.md` - /coach feature decisions & 10-second rule
3. `PRESET_MODEL_FINAL.md` - Ranking preset philosophy & locked model
4. `docs/README.md` - Technical architecture overview
5. `docs/RELEASE_FLOW.md` - Deployment process
6. `docs/Woo-Combine-Spec.md` - Original product specification

**Reference as Needed:**
- `docs/API_REFERENCE.md` - Backend API documentation
- `docs/DATA_CONTRACTS.md` - Database schemas
- `docs/guides/RENDER_DEPLOYMENT.md` - Hosting setup
- `docs/security/security-controls-checklist.md` - Security practices

**Product Decisions:**
- `docs/product/COACH_DASHBOARD_SCOPE.md` - Locked navigation architecture
- `PRESET_MODEL_FINAL.md` - Locked ranking preset model
- `docs/adr/` - Architecture decision records

---

## 12. 🎓 Onboarding Checklist

**Week 1: Understanding**
- [ ] Read this document completely
- [ ] Read COACH_DASHBOARD_SCOPE.md
- [ ] Access Render dashboard (ask for credentials)
- [ ] Access Sentry (error tracking)
- [ ] Access Firebase console
- [ ] Create test account on production
- [ ] Walk through all 3 user journeys (Organizer / Coach / Viewer)

**Week 2: Hands-On**
- [ ] Create a test league and event
- [ ] Upload players via CSV
- [ ] Try all ranking presets
- [ ] Generate teams
- [ ] Export rankings
- [ ] Test QR code invite flow
- [ ] Review recent commits and PRs

**Week 3: Product Decisions**
- [ ] Review open feature requests
- [ ] Apply 10-second rule to pending items
- [ ] Identify features that don't belong on /coach
- [ ] Document any gaps in this onboarding doc

**Ongoing:**
- [ ] Reference COACH_DASHBOARD_SCOPE.md for feature placement decisions
- [ ] Update this doc when major changes occur
- [ ] Keep product scope documents current

---

## 13. 🆘 Who to Ask

**Product Questions:**
- Role models, navigation decisions → Reference `docs/product/COACH_DASHBOARD_SCOPE.md`
- Feature placement → Apply 10-second rule
- User flows → Walk through journeys in §4

**Technical Questions:**
- Architecture → `docs/README.md` and `docs/arch/`
- Backend API → `docs/API_REFERENCE.md`
- Deployment → `docs/guides/RENDER_DEPLOYMENT.md`
- Data models → `docs/DATA_CONTRACTS.md`

**Operational Questions:**
- Incidents → `docs/runbooks/Incident-Response.md`
- Monitoring → Sentry dashboard
- Hosting → Render dashboard
- Database → Firebase console

---

## 14. 📝 Document Maintenance

This document should be updated when:
- ✅ Major product decisions made (like 10-second rule)
- ✅ Navigation architecture changes (locked items)
- ✅ New critical user journeys added
- ✅ Role model changes
- ✅ Significant technical architecture shifts
- ✅ New environments or tools introduced

**Last Updated:** January 2, 2026  
**Next Review:** When next major feature sprint begins

---

## 15. 🎯 TL;DR for Busy PMs

**Product in One Sentence:**  
WooCombine is a youth sports combine management platform where organizers run events and coaches analyze player performance through role-based dashboards optimized for operational speed.

**Key Architectural Decisions:**
1. **Organizer = superset of coach** (same pages, different controls)
2. **10-second rule** determines feature placement on command center
3. **Navigation locked** (5 links + contextual CTA, no more)
4. **/coach = operations**, /analytics = analysis, /players = roster work

**Most Important Files:**
- `docs/product/COACH_DASHBOARD_SCOPE.md` (product decisions arbiter)
- `PRESET_MODEL_FINAL.md` (ranking preset model & philosophy)
- `frontend/src/pages/CoachDashboard.jsx` (command center implementation)
- `frontend/src/components/Navigation.jsx` (role-based nav labels)

**Quick Tests:**
- Can organizer do this in <10 seconds during event? → If YES, might belong on /coach
- Does this require deep analysis? → Belongs in /analytics
- Is this roster management? → Belongs in /players

**Red Flags:**
- Adding permanent nav links without 10-second test
- Creating separate pages for same role functions
- Building analysis tools on command center
- Assuming pricing enforcement exists in code

**Success Metrics:**
- Average time on /coach: <2 minutes (it's a hub, not a destination)
- Time to first action: <10 seconds (clear next steps)
- Navigation bounce rate: High (users find what they need quickly)

---

*This document represents the current stable state of WooCombine. When in doubt about product decisions, reference the scope docs. When in doubt about technical implementation, reference the technical docs. When in doubt about processes, ask the team.*
