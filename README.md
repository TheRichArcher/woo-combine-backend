# WooCombine - Youth Sports Combine Platform

A comprehensive full-stack platform for managing youth sports combines and player evaluations.

## 🏗️ **Architecture**

### **Frontend**
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Domain**: https://woo-combine.com

### **Backend**
- **Framework**: FastAPI (Python)
- **Database**: Google Firestore
- **Authentication**: Firebase Admin SDK  
- **Domain**: https://woo-combine-backend.onrender.com

## 🚀 **Deployment**

### **Production (Render)**
- **Dev (auto-deploy)**: From `main` branch
- **Staging (protected)**: From `staging` branch, approval required
- **Prod (tags)**: Tagged releases `vX.Y.Z` with changelog entry
- **Frontend**: Static site build to `frontend/dist`; HTTPS enforced; HSTS via headers
- **Backend**: FastAPI web service in Docker, non-root; health check at `/health`
- **Health Check**: `/health` endpoint for monitoring (Render)
- **Autoscaling guidance**: min 1, max 4 instances; CPU 60%, Mem 70% (tune as needed)
- **Stateless**: Sticky sessions not required

### **Required Environment Variables**
Set these in your Render dashboard (and local `.env` files):

```bash
# Backend (FastAPI)
ALLOWED_ORIGINS=https://woo-combine.com
ENABLE_ROLE_SIMPLE=false
GOOGLE_CLOUD_PROJECT=your-project-id
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# Frontend (Vite)
VITE_API_BASE=https://woo-combine-backend.onrender.com/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_APP_ID=...
```

## 🛠️ **Local Development**

### **Backend Setup**
```bash
# in repo root
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ALLOWED_ORIGINS=http://localhost:5173
uvicorn backend.main:app --reload --port 10000
```

### **Frontend Setup**  
```bash
cd frontend
npm install
# copy .env.example to .env and set VITE_API_BASE=http://localhost:10000/api
npm run dev
```

See `docs/RELEASE_FLOW.md` and `docs/ENV_VARS_AND_RENDER_SETUP.md` for details.

### ⚡ Demo Seed (dev/staging)

Seed a ready-to-demo dataset in under 1 minute.

1) Ensure API has env:
   - `ENABLE_DEMO_SEED=true`
   - `DEMO_SEED_TOKEN=<secret>`
2) Run the seed script:
   - Local: `DEMO_SEED_TOKEN=$TOKEN python3 scripts/seed_demo.py --base-url http://localhost:10000`
   - Staging: `DEMO_SEED_TOKEN=$TOKEN python3 scripts/seed_demo.py --base-url https://<staging-host>`
3) Open the app and select `Demo League`. Follow `docs/guides/DEMO_SCRIPT.md` (5–7 min talk track).

## 🧪 **Testing & Quality**

### **Run Tests**
```bash
# Frontend linting & security
cd frontend && npm run lint && npm audit

# Backend dependency check
cd backend && python -m pip check
```

### **Health Checks**
```bash
# Backend health (prod)
curl https://woo-combine-backend.onrender.com/health
# Backend meta (debug flags)
curl https://woo-combine-backend.onrender.com/api/meta

# Full system test
visit https://woo-combine.com
```

## 📊 **Features**

- **League Management**: Create and join leagues with invite codes
- **Player Management**: CSV upload, manual entry, detailed profiles
- **Drill Results**: 40-yard dash, vertical jump, catching, throwing, agility
- **Real-time Rankings**: Weighted scoring with customizable presets
- **Event Scheduling**: Complete event lifecycle management
- **Role-based Access**: Organizer and coach permissions

## 📝 **Documentation**

- See `docs/README.md` for the full documentation index
- Key entries:
  - `docs/guides/PM_HANDOFF_GUIDE.md` - System architecture and debugging
  - `docs/guides/RENDER_DEPLOYMENT.md` - Deployment configuration guide
  - `docs/reports/COMPLETION_SUMMARY.md` - Project status and achievements

## 🔒 **Security**

- Firebase Authentication with email verification
- CORS configured for production domains via `ALLOWED_ORIGINS`
- Input validation and sanitization
- No known security vulnerabilities (regularly audited)
