# 🚨 Fix for woo-combine-backend-new.onrender.com Deployment

## **Current Situation**
- ❌ `woo-combine-backend-new.onrender.com` is serving HTML instead of API
- ✅ `woo-combine-backend.onrender.com` is working correctly
- ✅ Frontend has been temporarily fixed to use the working domain

## **Root Causes Identified**
1. **Health Check Path Mismatch** - Fixed in render.yaml
2. **Circular API URL Reference** - Fixed in render.yaml  
3. **Missing Environment Variables** - Needs manual setup
4. **Deployment Configuration Issues** - Fixed in render.yaml

## **🔧 Step-by-Step Fix Process**

### **Step 1: Update Render.yaml** ✅ **COMPLETED**
The render.yaml has been updated with these fixes:
- Changed `healthCheckPath` from `/api/health` to `/health`
- Fixed circular reference by using working domain for frontend build
- Maintained proper environment variable configuration

### **Step 2: Set Environment Variables in Render Dashboard**

**Go to your Render service dashboard for `woo-combine-backend-new`:**

1. **Navigate to Environment Variables**:
   - Dashboard → Services → woo-combine-backend-new → Environment

2. **Add Required Variables**:
   ```
   GOOGLE_CLOUD_PROJECT = woo-combine
   FIREBASE_PROJECT_ID = woo-combine
   GOOGLE_APPLICATION_CREDENTIALS_JSON = [your-firebase-json-as-single-line]
   ```

3. **Get Firebase JSON**:
   - Firebase Console → Project Settings → Service Accounts
   - Generate new private key → Download JSON
   - Convert to single line: `cat serviceAccount.json | tr -d '\n'`

### **Step 3: Deploy the Fixes**

**Option A: Auto-Deploy (if connected to GitHub)**
```bash
git add render.yaml RENDER_DEPLOYMENT_FIX.md
git commit -m "Fix woo-combine-backend-new deployment configuration"
git push origin main
```

**Option B: Manual Deploy**
- Go to Render dashboard
- Click "Manual Deploy" → "Deploy latest commit"

### **Step 4: Verify the Fix**

After deployment completes, test these endpoints:

```bash
# Health check (should return JSON)
curl https://woo-combine-backend-new.onrender.com/health

# API root (should return JSON)
curl https://woo-combine-backend-new.onrender.com/api

# Test API endpoint
curl https://woo-combine-backend-new.onrender.com/api/leagues/me
```

**Expected Results:**
- ✅ Health endpoint returns: `{"status":"ok",...}`
- ✅ API root returns: `{"message":"WooCombine API",...}`
- ✅ No HTML responses from API endpoints

### **Step 5: Switch Frontend Back to New Domain**

Once `woo-combine-backend-new.onrender.com` is working:

```bash
cd frontend
VITE_API_BASE=https://woo-combine-backend-new.onrender.com/api npm run build
```

Then test the frontend to ensure it works with the new backend.

## **🔍 Troubleshooting**

### **If Health Check Still Fails:**
```bash
# Check Render logs for specific errors
# Look for these common issues:
# - "Firestore connection error" → Check Firebase environment variables
# - "ModuleNotFoundError" → Check Python dependencies
# - "Port binding error" → Check start command
```

### **If Still Serving HTML:**
```bash
# Verify the endpoints directly:
curl -I https://woo-combine-backend-new.onrender.com/health
# Should show: Content-Type: application/json
# Not: Content-Type: text/html
```

### **If Environment Variables Missing:**
- Double-check they're set in Render dashboard
- Ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is valid JSON on single line
- Restart the service after adding variables

## **📋 Deployment Checklist**

- [ ] render.yaml updated with correct health check path
- [ ] Environment variables set in Render dashboard
- [ ] Firebase service account JSON configured
- [ ] Manual deployment triggered
- [ ] Health endpoint returning JSON (not HTML)
- [ ] API endpoints responding correctly
- [ ] Frontend rebuilt to use new domain
- [ ] End-to-end testing completed

## **🆘 Rollback Plan**

If the fix doesn't work immediately:
1. **Keep using the working domain** (`woo-combine-backend.onrender.com`)
2. **Frontend is already configured** to use the working domain
3. **Debug the new domain** without affecting users
4. **Switch back once confirmed working**

## **📞 Need Help?**

If issues persist:
1. Check Render deployment logs for specific errors
2. Test endpoints individually to isolate the problem
3. Verify environment variables are correctly set
4. Ensure Firebase credentials are valid

The working domain (`woo-combine-backend.onrender.com`) will continue to work while you fix the new one! 