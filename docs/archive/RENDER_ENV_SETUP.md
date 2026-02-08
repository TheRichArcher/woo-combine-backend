# Render Environment Setup Guide

## Frontend Service - Environment Variables

To configure the frontend properly on Render, set the following environment variable:

### Required Environment Variable

**Name**: `VITE_API_BASE`  
**Value**: `https://woo-combine-backend.onrender.com/api`

### How to Set on Render

1. Log into your Render Dashboard
2. Navigate to your **Frontend Service** (the static site/web service serving React)
3. Go to the **Environment** tab
4. Click **Add Environment Variable**
5. Enter:
   - **Key**: `VITE_API_BASE`
   - **Value**: `https://woo-combine-backend.onrender.com/api`
6. Click **Save Changes**
7. Render will automatically redeploy with the new environment variable

### Why This Matters

**Vite** (the build tool) only injects environment variables at **build time** that start with `VITE_`. 

- At build time, Vite reads `VITE_API_BASE` from the environment
- It replaces `import.meta.env.VITE_API_BASE` in the code with the actual URL
- This ensures the frontend knows where to find the backend API

### Runtime Fallback (Already Implemented)

The code includes a **runtime fallback** in `frontend/src/lib/api.js`:

```javascript
// If we're on the production domain, use the Render backend
if (hostname === 'woo-combine.com' || hostname === 'www.woo-combine.com') {
  return 'https://woo-combine-backend.onrender.com/api';
}
```

This means the app will work even without the environment variable set, but it's **best practice** to set it explicitly for:

1. **Clarity** - Makes configuration explicit
2. **Flexibility** - Easy to change backend URL without code changes
3. **Multiple environments** - Can set different URLs for staging/prod
4. **Preview deployments** - Won't break preview URLs with hardcoded production checks

### Testing Multiple Environments

For **local development**:
```bash
# In frontend/.env (create if it doesn't exist)
VITE_API_BASE=http://localhost:3000/api
```

For **staging** (if you have a staging backend):
```bash
# On Render staging frontend service
VITE_API_BASE=https://woo-combine-backend-staging.onrender.com/api
```

For **production** (already documented above):
```bash
# On Render production frontend service
VITE_API_BASE=https://woo-combine-backend.onrender.com/api
```

### Verification

After setting the environment variable and redeploying:

1. Open browser DevTools → Console
2. Check network requests - they should go to `https://woo-combine-backend.onrender.com/api/*`
3. If you see requests going to the wrong URL, the env var may not be set correctly

### Common Issues

**Issue**: Changes to `.env` file don't take effect  
**Solution**: `.env` files are gitignored. Use Render's environment variable UI instead.

**Issue**: Preview deployments use wrong backend  
**Solution**: The runtime fallback only works for exact production domains. For previews, set the env var on the preview service too.

**Issue**: Local development points to production backend  
**Solution**: Create `frontend/.env` locally with `VITE_API_BASE=http://localhost:3000/api`

---

## Backend Service - No Changes Needed

The backend service on Render is correctly configured. It already has:

- `ALLOWED_ORIGINS` set to include frontend domains
- Firebase credentials configured
- All necessary environment variables

No backend environment changes are needed for this fix.

