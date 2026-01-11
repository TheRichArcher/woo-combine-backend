# WooCombine Architecture Quick Reference

**Last Updated:** January 11, 2026

---

## 📚 Tech Stack

### **Frontend**
- **Framework**: React 18.3.1
- **Build Tool**: Vite 6.3.5
- **Routing**: React Router 7.1.0
- **Styling**: Tailwind CSS 3.4.17
- **State Management**: React Context API
- **Icons**: Lucide React
- **Auth**: Firebase Authentication
- **Database**: Firebase Firestore (client SDK)
- **Monitoring**: Sentry

### **Backend**
- **Framework**: FastAPI (Python)
- **Database**: Firebase Firestore (admin SDK)
- **Auth**: Firebase Admin SDK
- **Hosting**: Render (free tier with hibernation)
- **API**: RESTful endpoints with CORS support
- **Monitoring**: Sentry

### **Deployment**
- **Frontend**: Netlify (auto-deploy from main branch)
- **Backend**: Render (auto-deploy from main branch)
- **DNS**: woo-combine.com → Netlify, backend → Render subdomain

---

## 📁 Key File Locations

### **Frontend Structure**
```
frontend/
├── src/
│   ├── components/
│   │   ├── Players/
│   │   │   ├── ImportResultsModal.jsx      ⭐ CSV import system
│   │   │   └── AddPlayerModal.jsx
│   │   ├── AdminTools.jsx                  ⭐ Event setup & management
│   │   ├── EventSetup.jsx
│   │   └── Navigation.jsx                  ⭐ Main nav component
│   ├── pages/
│   │   ├── Home.jsx                        ⭐ Dashboard & routing logic
│   │   ├── Players.jsx                     ⭐ Player management & rankings
│   │   └── OnboardingEvent.jsx
│   ├── context/
│   │   ├── AuthContext.jsx                 ⭐ Authentication state
│   │   └── EventContext.jsx                ⭐ Event/league state
│   ├── utils/
│   │   ├── playerNumbering.js              ⭐ Auto-number assignment
│   │   ├── csvUtils.js                     ⭐ CSV parsing & validation
│   │   └── api.js                          ⭐ API client with retry logic
│   └── lib/
│       └── firebase.js                     ⭐ Firebase configuration
```

### **Backend Structure**
```
backend/
├── routes/
│   ├── players.py                          ⭐ Player CRUD & upload
│   ├── events.py                           ⭐ Event management
│   ├── imports.py                          ⭐ CSV parsing endpoint
│   └── leagues.py                          ⭐ League management
├── utils/
│   ├── identity.py                         ⭐ Player ID generation
│   ├── playerNumbering.js                  ⭐ Auto-numbering system
│   ├── lock_validation.py                  ⭐ Write permission checks
│   └── authorization.py                    ⭐ Access control
├── services/
│   └── schema_registry.py                  ⭐ Sport templates
└── main.py                                 ⭐ FastAPI app entry point
```

---

## 🔑 Key Concepts

### **Player Identity System**
Players are identified by deterministic IDs generated from:
```python
generate_player_id(event_id, first_name, last_name, number)
# Returns: SHA-256 hash of "event:first:last:number"
```

**Priority matching:**
1. `external_id` (if provided)
2. Name + Number hash

**Important:** When `number=None`, uses "nonum" which can cause collisions for duplicate names.

### **Jersey Number Auto-Assignment**
```javascript
getAgeGroupPrefix(ageGroup)
  ├─ 12U → 12 → 1201, 1202, 1203...
  ├─ 8U → 8 → 801, 802, 803...
  ├─ "Rookies" → 20 → 2001, 2002...
  └─ Unknown → 90 → 9001, 9002...  (stays under 9999 limit)
```

### **Ranking System**
**Formula:** Renormalized Weighted Average
- Normalize each drill to 0-100 scale within age group
- Apply weights as percentages (weight/100)
- Sum normalized weighted scores
- Backend and frontend use identical calculation

---

## 🚀 Common Commands

### **Development**
```bash
# Frontend
cd frontend
npm install
npm run dev          # Starts on localhost:5173

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### **Building**
```bash
# Frontend
cd frontend
npm run build        # Outputs to dist/

# Backend
cd backend
python -m py_compile routes/*.py    # Syntax check
```

### **Deployment**
```bash
git add .
git commit -m "feat: description"
git push origin main

# Auto-deploys to:
# - Frontend: Netlify (woo-combine.com)
# - Backend: Render (woo-combine-backend.onrender.com)
```

---

## 🔍 Debugging Tips

### **Frontend Issues**
1. Check browser console for errors
2. Look for `[DEBUG]` logs in console
3. Check Network tab for API failures
4. Verify AuthContext state in React DevTools

### **Backend Issues**
1. Check Render logs: https://dashboard.render.com
2. Look for `[UPLOAD_ERROR]` or `[ERROR]` in logs
3. Check for missing imports (common issue)
4. Verify Firebase permissions

### **Import Issues**
1. Check console for `[ImportResultsModal]` logs
2. Verify auto-numbering happened
3. Check backend logs for validation errors
4. See JANUARY_2026_IMPORT_FIXES.md for common issues

---

## 🐛 Known Gotchas

### **Backend Cold Start**
- Render free tier hibernates after 15 min inactivity
- First request after hibernation takes ~45 seconds
- Frontend shows "Server starting up" toast
- API client has automatic retry logic

### **Number Range Validation**
- Backend requires 0 <= number <= 9999
- Auto-numbering must respect this constraint
- Age group prefix * 100 + counter must stay under 9999

### **Function Imports**
- Common issue: calling function without importing it
- Always check imports when adding new utility calls
- Example: `check_write_permission` needs explicit import

### **React Hook Dependencies**
- Avoid circular dependencies in useCallback/useEffect
- Don't include state that the hook itself updates
- Can cause infinite loops or temporal dead zones

---

## 📊 API Endpoints

### **Core Endpoints**
```
# Authentication
GET  /api/users/me
POST /api/users/role

# Leagues
GET  /api/leagues/me
POST /api/leagues

# Events
GET  /api/leagues/{league_id}/events
POST /api/leagues/{league_id}/events
DELETE /api/events/{event_id}

# Players
GET  /api/players?event_id={event_id}
POST /api/players?event_id={event_id}
POST /api/players/upload                    ⭐ Bulk import
POST /api/players/revert-import

# Import
POST /api/events/{event_id}/parse-import    ⭐ CSV parsing

# Schema
GET  /api/events/{event_id}/schema
GET  /api/schemas                           ⭐ Sport templates
```

---

## 🔐 Environment Variables

### **Frontend (.env)**
```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_API_URL=https://woo-combine-backend.onrender.com
VITE_SENTRY_DSN=...
```

### **Backend (.env)**
```bash
FIREBASE_CREDENTIALS=... (JSON string)
CORS_ORIGINS=https://woo-combine.com
SENTRY_DSN=...
```

---

## 📈 Monitoring & Observability

### **Sentry**
- **Frontend**: Real-time error tracking
- **Backend**: Exception monitoring with stack traces
- **Access**: https://sentry.io

### **Logs**
- **Frontend**: Browser console
- **Backend**: Render dashboard logs
- **Pattern**: `[PREFIX]` for easy searching (e.g., `[UPLOAD_ERROR]`)

---

## 🎯 Quick Troubleshooting

### **"Failed to upload players"**
1. Check if backend is hibernating (cold start)
2. Check browser console for actual error message
3. Check backend logs for detailed stack trace
4. See JANUARY_2026_IMPORT_FIXES.md for resolution

### **"No league selected"**
1. Check AuthContext state
2. Verify league fetch completed
3. Check localStorage for cached league
4. Try logout → login

### **"Player numbers out of range"**
1. Check auto-numbering prefix (should be ≤ 97)
2. Verify age group mapping
3. See playerNumbering.js for algorithm

---

## 📞 Getting Help

1. **Search docs** in this folder first
2. **Check recent fixes** in PM_ONBOARDING_OVERVIEW.md
3. **Review known issues** in this file
4. **Check Sentry** for error patterns
5. **Ask team** with specific error messages and context

---

**This is a living document.** Update it when you discover new patterns or solutions!

