# WooCombine - Quick Start Guide for New Team Members

**Last Updated**: January 11, 2026  
**Build**: d9a3055 (Production)

Welcome to WooCombine! This guide will get you productive in **30 minutes** whether you're a developer, PM, or stakeholder.

---

## 📋 **Table of Contents**

1. [What is WooCombine?](#what-is-woocombine)
2. [Quick Architecture Overview](#quick-architecture-overview)
3. [For Product Managers](#for-product-managers)
4. [For Developers](#for-developers)
5. [For Stakeholders](#for-stakeholders)
6. [Common Tasks](#common-tasks)
7. [Recent Critical Fixes](#recent-critical-fixes)
8. [Key Resources](#key-resources)

---

## 🎯 **What is WooCombine?**

WooCombine is a **youth sports combine management platform** that helps organizers:
- Run athletic evaluations (40m dash, vertical jump, throwing, etc.)
- Track player performance across multiple drills
- Generate real-time rankings with customizable weights
- Manage staff permissions (organizer/coach/viewer roles)
- Export results and generate scorecards

### **Live URLs**
- **Frontend**: https://woo-combine.com
- **Backend API**: https://woo-combine-backend.onrender.com
- **API Docs**: https://woo-combine-backend.onrender.com/docs

### **Tech Stack**
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: FastAPI (Python) + Firebase Auth + Firestore
- **Hosting**: Render (both frontend and backend)
- **Version Control**: GitHub

---

## 🏗️ **Quick Architecture Overview**

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│  woo-combine    │────────▶│  woo-combine-    │────────▶│  Firestore  │
│     .com        │  HTTPS  │  backend.onrender│  Admin  │  Database   │
│   (React SPA)   │◀────────│  .com (FastAPI)  │◀────────│             │
└─────────────────┘         └──────────────────┘         └─────────────┘
        │                            │
        │                            │
        └────────────────┬───────────┘
                         ▼
                  ┌─────────────┐
                  │  Firebase   │
                  │  Auth       │
                  └─────────────┘
```

### **Key Concepts**
- **League**: Top-level organization (e.g., "Central Mass Youth Football")
- **Event**: A specific combine within a league (e.g., "Spring 2026 Tryouts")
- **Player**: Athlete participating in drills
- **Drill**: Specific test (40m dash, vertical jump, etc.)
- **Score**: Player's performance in a drill (stored in Firestore)

### **User Roles**
1. **Organizer**: Full access (create events, manage staff, lock combines)
2. **Coach**: Can edit scores and players (unless read-only)
3. **Viewer**: Read-only access to rankings and players

---

## 📊 **For Product Managers**

### **What You Need to Know**

#### **User Flows**
1. **Organizer Onboarding**: Sign up → Create league → Create event → Add players → Share QR codes
2. **Coach Joining**: Scan QR code → Sign up → Select role → View event
3. **Score Entry**: Live Entry mode (by player number) or individual player edit
4. **Permissions**: Organizers can toggle per-coach write access + global combine lock

#### **Current Feature Set (Production)**
✅ League/event management  
✅ CSV player import with auto-mapping  
✅ Multi-sport templates (Football, Baseball, Basketball, Soccer, Track)  
✅ Real-time weighted rankings  
✅ QR code invitations (role-specific)  
✅ Two-tier combine locking (global + per-coach)  
✅ Live Entry mode for rapid score input  
✅ Export to CSV  
✅ Player scorecards with drill breakdowns  

#### **Known Limitations**
- ⚠️ Render free tier has 15-minute hibernation (first request wakes backend ~45 seconds)
- ⚠️ Single backend instance only (autoscaling requires Redis migration)
- ⚠️ Email verification required (no SMS/phone auth currently)

### **Key Metrics to Track**
- **User Onboarding Success Rate**: % completing guided setup
- **Coach Invitation Success**: % joining via QR codes
- **Score Entry Speed**: Average time per drill entry (Live Entry mode)
- **Export Usage**: How many organizers export results
- **Mobile Usage**: % of scores entered on mobile devices

### **Feature Documentation**
- **Complete Feature List**: `docs/product/FEATURES_OVERVIEW.md`
- **User Flows**: `docs/guides/PM_ONBOARDING_OVERVIEW.md`
- **Combine Locking**: `docs/implementation/COMBINE_LOCKING_SYSTEM.md`
- **Live Entry Guide**: `docs/guides/LIVE_ENTRY_COMPREHENSIVE_GUIDE.md`

### **Recent Major Updates (Last 7 Days)**
1. ✅ Two-tier combine locking system deployed
2. ✅ Per-coach write permissions (read-only coaches)
3. ✅ Fixed CORS PATCH issue blocking permission toggles
4. ✅ Fixed admin-tools route and 401 logout loops
5. ✅ Fixed coach QR code join flow crash

**See**: `PRODUCTION_DEPLOYMENT_THREE_FIXES.md` and `CORS_PATCH_METHOD_FIX.md`

---

## 💻 **For Developers**

### **Getting Started (15 Minutes)**

#### **1. Clone Repository**
```bash
git clone https://github.com/TheRichArcher/woo-combine-backend.git
cd "WooCombine App"
```

#### **2. Backend Setup**
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (create .env file)
export ALLOWED_ORIGINS=http://localhost:5173
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
export LOG_LEVEL=DEBUG

# Run backend
uvicorn backend.main:app --reload --port 10000
```

**Verify**: http://localhost:10000/health should return `{"status": "ok"}`

#### **3. Frontend Setup**
```bash
cd frontend
npm install

# Create .env.local file:
cat > .env.local << EOF
VITE_API_BASE=http://localhost:10000/api
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_APP_ID=1:xxx:web:yyy
EOF

# Run frontend
npm run dev
```

**Verify**: http://localhost:5173 should show WooCombine welcome page

### **Code Structure**

#### **Backend** (`/backend`)
```
backend/
├── main.py                    # FastAPI app + CORS + middleware
├── auth.py                    # Firebase auth verification
├── routes/
│   ├── players.py            # Player CRUD + score updates
│   ├── leagues.py            # League management + member permissions
│   ├── events.py             # Event CRUD + locking
│   ├── drills.py             # Drill schema management
│   ├── imports.py            # CSV import + auto-mapping
│   └── ...
├── utils/
│   ├── lock_validation.py    # Two-tier permission checks
│   └── csvUtils.py           # CSV parsing + synonym matching
├── middleware/
│   ├── rate_limiting.py      # Rate limit decorators
│   └── security.py           # Security headers + validation
└── security/
    └── access_matrix.py      # Role-based permissions
```

#### **Frontend** (`/frontend/src`)
```
src/
├── pages/
│   ├── Home.jsx              # Dashboard
│   ├── Players.jsx           # Player management + rankings
│   ├── LiveEntry.jsx         # Rapid score entry mode
│   └── AdminTools.jsx        # Event settings + QR codes
├── components/
│   ├── Navigation.jsx        # Top nav + role checks
│   ├── StaffManagement.jsx  # Permission toggles
│   ├── EventSetup.jsx        # Event creation wizard
│   └── Players/
│       ├── ImportResultsModal.jsx  # CSV import
│       └── PlayerDetailsModal.jsx  # Score editing
├── context/
│   ├── AuthContext.jsx       # Firebase auth + league/role state
│   ├── EventContext.jsx      # Selected event management
│   └── ToastContext.jsx      # Notifications
└── lib/
    └── api.js                # Axios instance + 401/retry handling
```

### **Key Development Patterns**

#### **Authentication Flow**
```javascript
// Frontend: AuthContext manages Firebase auth + backend sync
const { user, userRole, selectedLeagueId } = useAuth();

// Backend: Decorators enforce permissions
@require_permission("players", "update", target="event")
def update_player(...): ...
```

#### **Permission Checks (Two-Tier System)**
```python
# Backend: utils/lock_validation.py
membership = check_write_permission(
    event_id=event_id,
    user_id=user_id,
    user_role=user_role,
    league_id=league_id
)
# Returns membership with canWrite field
# Throws 403 if event locked or user is read-only
```

#### **CSV Import Auto-Mapping**
```javascript
// Frontend: csvUtils.js
const synonyms = {
  'first_name': ['first name', 'fname', 'firstname', ...],
  'sprint_60': ['60 yard sprint', '60-yd', '60yd dash', ...]
};
// Matches CSV headers to canonical field names
```

### **Testing Strategy**

#### **Frontend Testing**
```bash
cd frontend
npm run lint          # ESLint
npm run build         # Production build test
npm audit             # Security audit
```

#### **Backend Testing**
```bash
source .venv/bin/activate
python -m pytest backend/tests/  # Unit tests
python -m pip check              # Dependency conflicts
```

#### **Manual Testing Checklist**
See: `docs/qa/MANUAL_CHECKLIST.md`

### **Common Development Tasks**

#### **Add a New Drill**
1. Update sport template: `backend/utils/sport_templates.py`
2. Add synonyms: `frontend/src/utils/csvUtils.js`
3. Test CSV import with new drill
4. Update scorecards: `frontend/src/components/Players/PlayerDetailsModal.jsx`

#### **Add a New Permission**
1. Define in access matrix: `backend/security/access_matrix.py`
2. Add decorator: `@require_permission("resource", "action")`
3. Update frontend role checks: `Navigation.jsx`
4. Test with different roles

#### **Fix CORS Issue**
1. Check `backend/main.py` line 98-115 (CORSMiddleware)
2. Ensure method in `allow_methods` list
3. Verify origin in `ALLOWED_ORIGINS` env var
4. Test OPTIONS preflight in Network tab

### **Debugging Tips**

#### **Backend Logs**
```bash
# Render dashboard → Services → woo-combine-backend → Logs
# Look for: [ERROR], [WARNING], [CRITICAL]
# Useful patterns: [CORS], [AUTH], [LOCK], [IMPORT]
```

#### **Frontend Console**
```javascript
// Check build SHA
console.log(window.__WOOCOMBINE_BUILD__);

// Check auth state
const { user, userRole } = useAuth();
console.log('User:', user?.uid, 'Role:', userRole);

// Enable verbose API logging
localStorage.setItem('DEBUG_API', 'true');
```

#### **Common Issues**
- **401 Errors**: Check Firebase token expiration, force refresh
- **403 Forbidden**: Check event lock status + per-coach permissions
- **CORS Errors**: Verify backend allows method + origin
- **Stale Data**: Clear localStorage + sessionStorage

---

## 👔 **For Stakeholders**

### **System Status (Production)**
- **Uptime**: ~99% (subject to Render free tier hibernation)
- **Current Build**: d9a3055 (Jan 11, 2026)
- **Active Users**: [Track via Firebase Analytics]
- **Known Issues**: None critical

### **Recent Fixes (Last 48 Hours)**
1. ✅ **Admin Tools Route**: Fixed blank `/admin-tools` page
2. ✅ **Coach Invitations**: Fixed QR code join crash
3. ✅ **Permission Toggles**: Fixed CORS blocking write permission changes
4. ✅ **Session Stability**: Fixed premature 401 logout loops

**Impact**: All core functionality now working in production

### **Security Posture**
- ✅ HTTPS enforced (HSTS enabled)
- ✅ CORS properly configured
- ✅ Rate limiting on all endpoints
- ✅ Firebase email verification required
- ✅ Role-based access control
- ✅ CSP headers enabled
- ⚠️ Single backend instance (scaling requires Redis)

### **Scalability**
- **Current**: Single Render instance (sufficient for 100-500 concurrent users)
- **Next Tier**: Multi-instance with Redis (1000+ users)
- **Database**: Firestore (auto-scales, pay-per-use)

### **Cost Structure** (Estimates)
- Render Backend: $7-25/month (depends on instance size)
- Render Frontend: $0 (static site)
- Firebase: $0-50/month (depends on usage)
- **Total**: ~$10-75/month for small-medium usage

---

## 🔧 **Common Tasks**

### **Deploy to Production**
```bash
# 1. Commit your changes
git add .
git commit -m "fix: description"

# 2. Push to main (triggers auto-deploy)
git push origin main

# 3. Monitor deployment
# - Frontend: Render dashboard (2-5 min)
# - Backend: Render dashboard (5-10 min)

# 4. Verify
curl https://woo-combine-backend.onrender.com/health
# Check frontend at https://woo-combine.com
```

### **Add New User Role**
1. Update `access_matrix.py` with permissions
2. Add role to `AuthContext.jsx` validation
3. Update `SelectRole.jsx` UI
4. Test role switching and permission enforcement

### **Debug Production Issue**
1. **Check Render Logs**: Backend service → Logs tab
2. **Check Browser Console**: Network tab + Console errors
3. **Verify Build SHA**: Should match latest commit
4. **Test in Incognito**: Rule out cache issues
5. **Check Firestore**: Verify data structure matches code

### **Run Database Migration**
```bash
# 1. Create migration script in backend/scripts/
# 2. Test on staging/local first
# 3. Run with proper credentials
python3 backend/scripts/your_migration.py
```

### **Update Documentation**
```bash
# 1. Edit relevant .md file in /docs
# 2. Update CHANGELOG.md
# 3. Commit with descriptive message
git commit -m "docs: update X for Y"
```

---

## 🚨 **Recent Critical Fixes**

### **January 11, 2026**

#### **1. CORS PATCH Method Missing (d9a3055)**
**Problem**: Write permission toggles failing with CORS preflight errors  
**Impact**: Could not toggle per-coach permissions or combine locks  
**Fix**: Added PATCH to allowed methods in CORS middleware  
**Verification**: Toggle write permission in Staff & Access Control  
**Docs**: `CORS_PATCH_METHOD_FIX.md`

#### **2. Admin Tools Route Missing (e8a7fb0)**
**Problem**: `/admin-tools` showed blank page  
**Impact**: Navigation broken from CoachDashboard  
**Fix**: Added redirect route `/admin-tools` → `/admin`  
**Verification**: Navigate to `/admin-tools`, should redirect  
**Docs**: `ADMIN_TOOLS_401_FIX.md`

#### **3. JoinEvent addLeague Crash (021d5ff)**
**Problem**: QR code join flow crashed with "addLeague is not defined"  
**Impact**: Coaches couldn't join via invitations  
**Fix**: Removed unused dependency from useEffect array  
**Verification**: Scan coach QR code, complete join flow  
**Docs**: `PRODUCTION_DEPLOYMENT_THREE_FIXES.md`

#### **4. 401 Logout Loops (e8a7fb0)**
**Problem**: Schema/leagues 401 errors triggered immediate logout  
**Impact**: Unexpected logouts during normal use  
**Fix**: Enhanced 401 handling to distinguish auth failures from permission issues  
**Verification**: Monitor console for 401 patterns, should not logout  
**Docs**: `ADMIN_TOOLS_401_FIX.md`

---

## 📚 **Key Resources**

### **Essential Documentation**
- **This Guide**: `/ONBOARDING_QUICK_START.md`
- **PM Overview**: `docs/guides/PM_ONBOARDING_OVERVIEW.md`
- **Getting Started (Dev)**: `docs/GETTING_STARTED.md`
- **Features Overview**: `docs/product/FEATURES_OVERVIEW.md`
- **API Reference**: `docs/API_REFERENCE.md`
- **Deployment Guide**: `docs/guides/RENDER_DEPLOYMENT.md`

### **Technical Deep Dives**
- **Combine Locking**: `docs/implementation/COMBINE_LOCKING_SYSTEM.md`
- **CSV Import**: `docs/reports/IMPORT_JERSEY_NAME_AUTOMAP_FIX.md`
- **Live Entry**: `docs/guides/LIVE_ENTRY_COMPREHENSIVE_GUIDE.md`
- **Permission System**: `docs/security/security-controls-checklist.md`

### **Recent Fixes**
- **CORS PATCH**: `CORS_PATCH_METHOD_FIX.md`
- **Admin Route + 401**: `ADMIN_TOOLS_401_FIX.md`
- **Join Flow + Routes**: `PRODUCTION_DEPLOYMENT_THREE_FIXES.md`

### **Operations**
- **Incident Response**: `docs/runbooks/Incident-Response.md`
- **Rate Limiting**: `docs/runbooks/Rate-Limit-Tuning.md`
- **Firestore Quota**: `docs/runbooks/Firestore-Quota-Exceeded.md`

### **Testing**
- **Manual Checklist**: `docs/qa/MANUAL_CHECKLIST.md`
- **QA Procedures**: `docs/qa/` (various test plans)

---

## 🎓 **Learning Path**

### **Day 1: Understanding the System**
1. Read this document (30 min)
2. Browse live site as organizer (30 min)
3. Review architecture diagram (15 min)
4. Explore code structure (30 min)

### **Day 2: Local Development**
1. Set up local environment (1 hour)
2. Make small UI change (1 hour)
3. Test locally (30 min)
4. Deploy to staging/test (30 min)

### **Day 3: Feature Deep Dive**
1. Pick a feature to study (CSV import, Live Entry, or Locking)
2. Read documentation (1 hour)
3. Trace code flow (1 hour)
4. Make enhancement or fix bug (2 hours)

### **Week 1: Full Contribution**
- Completed onboarding and local setup
- Made first meaningful contribution
- Understand core user flows
- Can debug common issues independently

---

## 💬 **Getting Help**

### **Questions?**
- **Code Issues**: Check existing documentation in `/docs`
- **Bugs**: Search recent fix documentation (root directory .md files)
- **Features**: See `docs/product/FEATURES_OVERVIEW.md`
- **Deployment**: See `docs/guides/RENDER_DEPLOYMENT.md`

### **Need More Info?**
Review the comprehensive docs in `/docs` organized by:
- `/guides` - How-to guides
- `/product` - Feature specifications
- `/implementation` - Technical designs
- `/reports` - Incident reports and fixes
- `/runbooks` - Operations procedures
- `/qa` - Testing checklists

---

**Welcome to the team! 🎉**

You're now ready to contribute to WooCombine. Start with local setup, explore the codebase, and don't hesitate to ask questions. The documentation is extensive, so use this guide as your starting point and branch out as needed.

Happy coding! 🚀

