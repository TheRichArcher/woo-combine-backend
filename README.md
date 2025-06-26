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
- **Auto-deploy**: Configured from GitHub main branch
- **Build Process**: Frontend builds first, then backend serves both
- **Health Check**: `/health` endpoint for monitoring

### **Required Environment Variables**
Set these in your Render dashboard:

```bash
# Firebase Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
FIREBASE_PROJECT_ID=your-project-id  
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# Build Configuration
PYTHON_VERSION=3.11.11
VITE_API_BASE=https://woo-combine-backend.onrender.com
```

## 🛠️ **Local Development**

### **Backend Setup**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### **Frontend Setup**  
```bash
cd frontend
npm install
npm run dev
```

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
# Backend health
curl https://woo-combine-backend.onrender.com/health

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

- `PM_HANDOFF_GUIDE.md` - System architecture and debugging
- `RENDER_DEPLOYMENT.md` - Deployment configuration guide
- `COMPLETION_SUMMARY.md` - Project status and achievements

## 🔒 **Security**

- Firebase Authentication with email verification
- CORS configured for production domains
- Input validation and sanitization
- No known security vulnerabilities (regularly audited)
