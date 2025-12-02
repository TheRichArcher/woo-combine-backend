# WooCombine PM Handoff & Onboarding Guide

_Last updated: December 2, 2025_

This guide serves as the primary source of truth for the WooCombine product state, architecture, and operational procedures. It supersedes previous debugging guides and reflects the current **stable, production-ready** status of the application following the comprehensive December 2025 stabilization sprint.

---

## 1. 🟢 Executive Status: Production Ready

The application has graduated from "debugging/crisis" mode to a stable product.

- **Stability**: Critical infinite loops, race conditions, and temporal dead zones have been definitively resolved.
- **Quality**: Zero linting errors, clean build process, and no console log noise.
- **Security**: Phone authentication and reCAPTCHA have been **completely removed** in favor of a robust, verified Email/Password flow.
- **UX**: Onboarding flows (Organizer & Invited Users) are fully guided with "What's Next" steps and no dead ends.

---

## 2. 🏗 System Architecture

### Frontend (Client)
- **Tech**: React 18 + Vite + Tailwind CSS.
- **Auth**: Firebase Authentication (Email/Password only).
- **State Management**:
  - `AuthContext`: Handles user session, role checks, and league context. *Refactored to remove circular dependencies and infinite loops.*
  - `EventContext`: Minimalist context to avoid initialization race conditions.
- **Data Access**: All data operations go through the backend API (`/api/v1`). **No direct Firestore writes from the frontend.**
- **Key Components**:
  - `Players.jsx`: The core workspace. Features tabbed interface (Management vs. Exports), real-time weight sliders, and normalized ranking calculations.
  - `OnboardingEvent.jsx`: The "Wizard" for new organizers.
  - `AdminTools.jsx`: QR code generation, roster uploads, and event settings.

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

---

## 4. 🛠 Recent Major Upgrades (Dec 2025)

We have completed a massive cleanup and optimization sprint. Here is what changed:

### 🔐 Authentication & Security
- **Removed Phone Auth & reCAPTCHA**: Eliminated complexity, costs, and configuration issues. Simplified to standard Email/Password.
- **Role Security**: Fixed vulnerability where invited users could escalate privileges. QR codes now strictly enforce roles.
- **Firebase Optimization**: Removed all direct client-side Firestore access. All permissions are now managed by the backend.

### ⚡ Performance & Stability
- **Infinite Loops Fixed**: Resolved `useEffect` dependency loops in `AuthContext` and `Players.jsx` that caused API flooding.
- **React Hooks Ordering**: Fixed "Minified React error #310" by enforcing strict Hook ordering at component top-levels.
- **Temporal Dead Zones**: Resolved circular dependency and variable initialization issues in production builds.
- **Cold Starts**: Implemented "Toast" notifications to warn users of Render cold starts (15-45s delays) without blocking UI.

### 🎨 UX & Polish
- **Onboarding**: Transformed passive bullet points into actionable buttons (e.g., "Start Live Entry").
- **Notifications**: Removed annoying/redundant popup spam (toasts) during normal workflows.
- **Player Numbering**: Fixed bug where CSV uploads caused duplicate jersey numbers.
- **Navigation**: Fixed "No League Context" flashes and loading screen jitters.

---

## 5. 📊 Operational Guide

### Deployment
- **Platform**: Render (Auto-deploy from `main` branch).
- **Environment**: Production is `woo-combine.com`.
- **Testing**: Stakeholder prefers testing directly in Production (Smoke tests required after deploy).

### Monitoring
- **Logs**: Check Render Dashboard for backend logs.
- **Client Errors**: Currently rely on user reports. **Recommended**: Add Sentry or LogRocket.

### Known Limitations
- **Render Cold Starts**: Free tier backend sleeps after 15m inactivity. First request takes ~45s.
  - *Mitigation*: Frontend shows "Server is starting..." toast. API client retries with exponential backoff.
- **Mobile Layout**: Optimized for standard phones, but complex tables (Rankings) are dense on small screens.

---

## 6. 🔮 Handoff & Next Steps

### Immediate Priorities
1. **Documentation**: Maintain this guide as the primary reference.
2. **Analytics**: Implement basic tracking (PostHog/Google Analytics) to measure Onboarding completion rates.
3. **Scale**: Monitor Firestore read/write costs as user base grows.

### Key Files & Directories
```
frontend/src/
├── context/
│   ├── AuthContext.jsx          # Auth + league/event state
│   ├── EventContext.jsx         # Minimal event state
│   └── ToastContext.jsx         # UX notifications
├── pages/
│   ├── Home.jsx                 # Dashboard routing
│   ├── OnboardingEvent.jsx      # Guided setup wizard
│   ├── Players.jsx              # Core workspace
│   └── AdminTools.jsx           # Admin settings
└── lib/api.js                   # Axios with retries

backend/
├── routes/
│   ├── users.py                 # User management
│   ├── leagues.py               # League logic
│   └── events.py                # Event logic
└── main.py                      # App entry point
```

---
