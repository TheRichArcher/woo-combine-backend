# Getting Started - Developer Setup

**Last Updated:** January 11, 2026

Welcome! This guide will get you up and running with WooCombine development.

---

## ⚡ Quick Start (5 minutes)

```bash
# 1. Clone the repository
git clone [repository-url]
cd WooCombine-App

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Install backend dependencies
cd ../backend
pip install -r requirements.txt

# 4. Set up environment variables (see below)

# 5. Run frontend (in one terminal)
cd frontend
npm run dev

# 6. Run backend (in another terminal)
cd backend
uvicorn main:app --reload --port 8000

# 7. Open browser to http://localhost:5173
```

---

## 🔧 Prerequisites

### **Required**
- **Node.js**: v18+ ([Download](https://nodejs.org/))
- **Python**: 3.9+ ([Download](https://python.org/))
- **Git**: Latest version
- **Code Editor**: VS Code recommended

### **Recommended**
- **Browser**: Chrome or Firefox (for DevTools)
- **Terminal**: iTerm2 (Mac) or Windows Terminal
- **Extensions**: React DevTools, Firebase DevTools

---

## 📦 Installation Steps

### **1. Frontend Setup**

```bash
cd frontend
npm install
```

**Create `.env` file:**
```bash
# frontend/.env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=http://localhost:8000
VITE_SENTRY_DSN=your_sentry_dsn (optional)
```

**Note:** Get Firebase credentials from project settings or from a team member.

### **2. Backend Setup**

```bash
cd backend
pip install -r requirements.txt
```

**Create `.env` file:**
```bash
# backend/.env
FIREBASE_CREDENTIALS='{"type":"service_account",...}'
CORS_ORIGINS=http://localhost:5173
SENTRY_DSN=your_sentry_dsn (optional)
```

**Note:** Firebase service account credentials are JSON. Keep the entire JSON as a single-line string.

---

## 🚀 Running Locally

### **Development Mode**

**Terminal 1 (Frontend):**
```bash
cd frontend
npm run dev

# Runs on: http://localhost:5173
# Hot reload enabled
```

**Terminal 2 (Backend):**
```bash
cd backend
uvicorn main:app --reload --port 8000

# Runs on: http://localhost:8000
# Auto-reloads on file changes
```

### **Build Mode (Testing Production)**

**Frontend:**
```bash
cd frontend
npm run build         # Creates dist/ folder
npm run preview       # Serves dist/ on port 4173
```

**Backend:**
```bash
cd backend
python -m py_compile routes/*.py    # Syntax check
uvicorn main:app --port 8000        # No --reload flag
```

---

## 🧪 Testing Your Setup

### **1. Backend Health Check**
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### **2. Frontend Load**
1. Open http://localhost:5173
2. Should see login page
3. Check browser console for no errors

### **3. Full Flow Test**
1. Create test account (signup)
2. Verify email (check Firebase console or email)
3. Create league → Create event → Add player
4. Verify player appears in database

---

## 📝 Development Workflow

### **Making Changes**

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes
# - Frontend: Edit files in frontend/src
# - Backend: Edit files in backend/routes or backend/utils

# 3. Test locally
# - Check console for errors
# - Test affected functionality
# - Verify in both Chrome and Firefox

# 4. Commit changes
git add .
git commit -m "feat: description of your changes"

# 5. Push to remote
git push origin feature/your-feature-name

# 6. Create pull request
# - Go to GitHub
# - Create PR from your branch to main
# - Request review
```

### **Commit Message Format**
```
feat: Add new feature
fix: Fix bug in existing feature
docs: Update documentation
refactor: Code refactoring
test: Add or update tests
chore: Maintenance tasks
```

---

## 🐛 Debugging

### **Frontend Debugging**

**React DevTools:**
```bash
# Install browser extension
# Chrome: https://chrome.google.com/webstore
# Firefox: https://addons.mozilla.org
```

**Console Logging:**
```javascript
// Look for [DEBUG] prefixed logs
console.log("[DEBUG] State:", state);

// Check specific contexts
console.log("[AUTH]", useAuth());
console.log("[EVENT]", useEvent());
```

**Network Tab:**
- Monitor API calls
- Check request/response payloads
- Look for 400/500 errors

### **Backend Debugging**

**Print Debugging:**
```python
import logging
logging.info(f"[DEBUG] Variable: {variable}")
logging.error(f"[ERROR] Exception: {e}")
```

**Interactive Debugging:**
```python
# Add breakpoint
import pdb; pdb.set_trace()

# Or use debugger in VS Code
# Add breakpoint (click left of line number)
# Run with debugger attached
```

**Log Levels:**
```python
logging.debug()    # Verbose details
logging.info()     # General information
logging.warning()  # Warnings
logging.error()    # Errors
```

---

## 🔥 Common Issues & Solutions

### **Issue: "Module not found"**
```bash
# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Backend
cd backend
pip install -r requirements.txt --force-reinstall
```

### **Issue: "Firebase authentication failed"**
- Check `.env` file exists and has correct values
- Verify Firebase project settings
- Check CORS origins include localhost

### **Issue: "Backend connection refused"**
- Verify backend is running on port 8000
- Check VITE_API_URL in frontend/.env
- Look for CORS errors in browser console

### **Issue: "Port already in use"**
```bash
# Find and kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Or port 8000 (backend)
lsof -ti:8000 | xargs kill -9
```

### **Issue: "Database write failed"**
- Check Firebase service account permissions
- Verify Firestore security rules
- Check backend logs for detailed error

---

## 🚢 Deployment

### **Automatic Deployment**
Both frontend and backend auto-deploy when you push to `main` branch:

```bash
git checkout main
git merge feature/your-feature
git push origin main

# Frontend deploys to: woo-combine.com (Netlify)
# Backend deploys to: woo-combine-backend.onrender.com (Render)
```

### **Manual Deployment (if needed)**

**Frontend (Netlify):**
1. Build locally: `npm run build`
2. Drag `dist/` folder to Netlify dashboard
3. Or use Netlify CLI: `netlify deploy --prod`

**Backend (Render):**
1. Push to GitHub (auto-deploys)
2. Or use Render dashboard to trigger manual deploy
3. Monitor logs for startup issues

---

## 📚 Learning Resources

### **Documentation**
- `PM_ONBOARDING_OVERVIEW.md` - Complete system overview
- `ARCHITECTURE_QUICK_REFERENCE.md` - Tech stack and file locations
- `JANUARY_2026_IMPORT_FIXES.md` - Example debugging process

### **External Resources**
- [React Docs](https://react.dev/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Firebase Docs](https://firebase.google.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### **Code Examples**
Look at existing components for patterns:
- `ImportResultsModal.jsx` - Complex modal with state management
- `Players.jsx` - Data fetching and display
- `routes/players.py` - API endpoint with validation

---

## 🎯 Next Steps

Once your environment is set up:

1. **Explore the codebase**
   - Start with main entry points (Home.jsx, main.py)
   - Follow the data flow for one feature
   - Read comments and documentation

2. **Make a small change**
   - Fix a typo or update UI text
   - Add console.log to understand flow
   - Test that your change deploys correctly

3. **Join the team**
   - Ask questions in team chat
   - Review open pull requests
   - Pick up a small bug fix task

---

## 💡 Pro Tips

1. **Use VS Code workspace settings** for consistent formatting
2. **Enable auto-save** to see changes immediately
3. **Keep terminals visible** to catch errors quickly
4. **Use React DevTools** to inspect component state
5. **Check Sentry** for production errors before coding

---

## 🆘 Getting Help

1. **Search this folder** for relevant docs first
2. **Check known issues** in ARCHITECTURE_QUICK_REFERENCE.md
3. **Review recent fixes** in PM_ONBOARDING_OVERVIEW.md
4. **Ask in team chat** with:
   - What you're trying to do
   - What error you're seeing
   - What you've already tried

---

**Happy coding! 🚀**

