# 🚀 PM Handoff Guide - WooCombine App

## 📋 **CRITICAL STATUS OVERVIEW**

### Current Situation
- **BLOCKING ISSUE**: All business logic API calls timeout after 30 seconds
- **Impact**: Users can't create leagues, complete onboarding, or use core app features
- **Infrastructure**: Healthy (CORS, Firestore connectivity, auth all working)
- **Root Cause**: Unknown - currently debugging

---

## 🏗️ **SYSTEM ARCHITECTURE**

### Frontend
- **Framework**: React + Vite
- **Domain**: https://woo-combine.com
- **Auth**: Firebase Authentication
- **State**: Context API for user/league management

### Backend  
- **Framework**: FastAPI (Python)
- **Domain**: https://woo-combine-backend.onrender.com
- **Database**: Google Firestore
- **Auth**: Firebase Admin SDK
- **Hosting**: Render

### Key Dependencies
- Firebase Admin SDK for backend auth
- Google Cloud Firestore for data storage
- CORS configured for cross-origin requests

---

## 🛠️ **DEBUGGING TOOLS (NEWLY ADDED)**

### Quick Health Checks
- `/health` - Basic backend health
- `/cors-test` - CORS configuration test
- `/test-firestore` - Basic Firestore connectivity

### Advanced Debug Endpoints
- `/debug/system` - System info and environment variables
- `/debug/auth` - Authentication module status
- `/debug/firestore-ops` - Comprehensive Firestore operation testing
- `/debug/test-league-creation` - Test league creation without auth

### How to Use Debug Tools
1. Visit: `https://woo-combine-backend.onrender.com/debug/system`
2. Check all endpoints for errors or unexpected responses
3. Use `/debug/test-league-creation` to isolate business logic issues

---

## 🔧 **CURRENT DEBUG STATE**

### What's Enabled
- Only `leagues` router active (others commented out)
- Comprehensive logging configured
- Debug endpoints added for systematic testing

### What's Disabled
- `players`, `events`, `drills` routers (for isolation)
- Some business logic endpoints marked as NotImplemented

### Recent Fixes Applied ✅
- Static file mounting order (was shadowing API routes)
- Firebase Admin SDK initialization 
- CORS middleware configuration
- Token refresh after email verification
- Onboarding race condition fixes

---

## 🎯 **IMMEDIATE NEXT STEPS**

### 1. Complete Current Debug Session
```bash
# Test the problematic endpoint
curl -X POST https://woo-combine-backend.onrender.com/debug/test-league-creation

# Check if it succeeds or times out
# Review Render logs for where it hangs
```

### 2. Enable Routers Systematically  
- Test `/debug/test-league-creation` first
- If it works, test authenticated `/leagues` endpoint
- Enable other routers one by one once root cause found

### 3. Check Authentication Flow
- Verify Firebase ID tokens are valid
- Check if auth middleware is causing hangs
- Test with `/debug/auth` endpoint

---

## 📁 **KEY FILES & LOCATIONS**

### Backend Structure
```
backend/
├── main.py              # FastAPI app, middleware, debug endpoints
├── auth.py              # Firebase auth, user verification
├── firestore_client.py  # Firestore connection
└── routes/
    ├── leagues.py       # League CRUD (currently enabled)
    ├── players.py       # Player management (disabled)
    ├── events.py        # Event management (disabled) 
    └── drills.py        # Drill results (disabled)
```

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── VerifyEmail.jsx  # Email verification flow
│   ├── SelectRole.jsx   # Role selection onboarding
│   └── CreateLeague.jsx # League creation (timing out)
├── context/
│   ├── AuthContext.jsx  # Firebase auth state
│   └── EventContext.jsx # Event/league state
└── lib/
    └── api.js           # Axios instance with auth headers
```

---

## 🔍 **DEBUGGING WORKFLOW**

### When You Find an Issue
1. **Reproduce**: Use debug endpoints to isolate
2. **Log**: Check Render backend logs for exact failure point
3. **Test**: Use curl/Postman to bypass frontend
4. **Fix**: Make targeted fixes
5. **Verify**: Test with debug endpoints before re-enabling

### Log Analysis
- Look for logs that stop mid-execution
- Check for Firebase/Firestore errors
- Note any authentication failures
- Watch for timeout patterns

---

## 🚨 **KNOWN ISSUES & WORKAROUNDS**

### Issue: API Timeouts
- **Symptom**: 30-second timeouts on business logic
- **Workaround**: Use debug endpoints to test components
- **Status**: Under investigation

### Issue: No Firestore Writes
- **Symptom**: No user/league docs created despite auth working
- **Investigation**: Check if requests reach business logic
- **Test**: Use `/debug/test-league-creation`

---

## 📞 **DEPLOYMENT & ENVIRONMENT**

### Render Backend
- **Auto-deploy**: Enabled from GitHub main branch
- **Logs**: Available in Render dashboard
- **Environment**: Production environment variables configured

### Environment Variables Needed
- `GOOGLE_APPLICATION_CREDENTIALS` - Firebase service account
- `PORT` - Set by Render automatically

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend  
cd frontend
npm install
npm run dev
```

---

## 🎯 **SUCCESS CRITERIA**

### Phase 1: Identify Root Cause
- [ ] Determine why API calls timeout
- [ ] Isolate specific operation causing hang
- [ ] Test fix with debug endpoints

### Phase 2: Restore Functionality
- [ ] Fix identified issue
- [ ] Re-enable all routers
- [ ] Verify end-to-end user flows

### Phase 3: Validation
- [ ] User can sign up and verify email
- [ ] User can complete onboarding and select role
- [ ] User can create leagues and access admin features

---

## 🆘 **EMERGENCY CONTACTS & RESOURCES**

### Technical Resources
- Firebase Console: [Firebase Project]
- Render Dashboard: [Backend Service]
- GitHub Repository: [Project Repo]

### Quick Command Reference
```bash
# Check backend logs
curl https://woo-combine-backend.onrender.com/debug/system

# Test Firestore operations
curl https://woo-combine-backend.onrender.com/debug/firestore-ops

# Test league creation
curl -X POST https://woo-combine-backend.onrender.com/debug/test-league-creation

# Check git status
git status && git log --oneline -10
```

---

**Last Updated**: [Current Date]  
**Status**: Ready for new PM - debug tools configured, issues documented, next steps clear 