# WooCombine Render Deployment Guide

## ✅ What's Been Fixed

The following issues have been resolved in the codebase:

1. **Firebase Credentials** - Now uses environment variables instead of file paths
2. **Startup Error Handling** - Better error handling to prevent server shutdowns
3. **Health Checks** - Proper `/health` endpoint for Render monitoring
4. **Frontend Build** - Updated build process in `render.yaml`

## 🔧 Required Setup in Render Dashboard

To complete the deployment, you need to set these **environment variables** in your Render service dashboard:

### **❗ CRITICAL - Required Variables:**

⚠️ **Without these, your deployment will fail with Firestore errors!**

1. **GOOGLE_CLOUD_PROJECT**
   - Value: Your Firebase project ID (e.g., `woo-combine-12345`)

2. **FIREBASE_PROJECT_ID** 
   - Value: Same as above (your Firebase project ID)

3. **GOOGLE_APPLICATION_CREDENTIALS_JSON** ⭐ **MOST IMPORTANT**
   - Value: Your Firebase service account JSON as a single line
   - Get this from: Firebase Console → Project Settings → Service Accounts → Generate new private key
   - **Critical:** Must be valid JSON compressed to a single line (no newlines/spaces)
   - **This fixes the "DefaultCredentialsError" in your logs**

### **Optional Variables (for enhanced functionality):**

4. **FIREBASE_AUTH_DOMAIN**
   - Value: `your-project-id.firebaseapp.com`

5. **FIREBASE_API_KEY**
   - Value: Your Firebase web API key

## 🚀 Deployment Steps

1. **Set Environment Variables**:
   - Go to your Render service dashboard
   - Navigate to "Environment" tab
   - Add the required variables above

2. **Trigger Deployment**:
   - Push this commit to your repository
   - Render will automatically redeploy

3. **Verify Deployment**:
   - Check the health endpoint: `https://your-service.onrender.com/health`
   - Should return JSON with `"status": "ok"`

## 🔍 Troubleshooting

### Local Testing
```bash
# Test your deployment setup locally
python scripts/deploy-debug.py
```

### Common Issues

**🔴 "DefaultCredentialsError" or "Failed to parse JSON credentials"**
- **Solution**: Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` in Render environment variables
- JSON must be valid and compressed to a single line
- This is the most common deployment failure

**🔴 "Client.__init__() got an unexpected keyword argument 'options'"**
- **Fixed**: This was caused by incompatible Firestore client options
- The latest code removes the problematic options parameter

**🟡 "Frontend not found"**
- **Expected**: This warning is normal for backend-only deployments
- The build process creates the frontend automatically for full-stack deployments

**🔴 "Health check timeout"**
- Server is starting but crashing due to missing environment variables
- Check Render logs for specific error messages
- Usually caused by missing Firebase credentials

## 📋 Firebase Service Account Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Convert to single line:
   ```bash
   # Remove newlines and spaces
   cat serviceAccount.json | tr -d '\n' | tr -d ' '
   ```
7. Copy the result and paste as `GOOGLE_APPLICATION_CREDENTIALS_JSON` in Render

## ✅ Expected Result

After setting up environment variables and redeploying:

- ✅ Server starts without shutting down
- ✅ Health check passes: `/health` returns `{"status": "ok"}`
- ✅ Frontend loads at your Render URL
- ✅ API endpoints work correctly
- ✅ Firestore connection established

## 🆘 Need Help?

If you're still having issues:
1. Check Render deployment logs for specific error messages
2. Run the debug script locally: `python scripts/deploy-debug.py`
3. Verify environment variables are set correctly in Render dashboard 