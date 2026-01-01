# Quick Curl Test for Routing Verification

## Purpose
Prove that `/api/leagues/me` exists and returns correct shape in 10 seconds.

## Prerequisites
1. Get a Firebase ID token from a logged-in user
2. Have curl installed (comes with macOS/Linux)

## How to Get an ID Token

### Option A: From Browser Console (Easiest)
1. Log into woo-combine.com
2. Open Chrome DevTools → Console
3. Run:
```javascript
firebase.auth().currentUser.getIdToken().then(token => {
  console.log('TOKEN:', token);
  // Also copy to clipboard
  copy(token);
});
```
4. Token is copied to clipboard

### Option B: From Network Tab
1. Log into woo-combine.com
2. Open Chrome DevTools → Network tab
3. Find any API request to backend
4. Look at Request Headers → Authorization
5. Copy the token after "Bearer "

## Test Command

### For New User (No Leagues):
```bash
curl -i https://woo-combine-backend.onrender.com/api/leagues/me \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE"
```

**Expected Response**:
```
HTTP/2 200 
content-type: application/json
...

{"leagues": []}
```

### For Existing User (Has Leagues):
```bash
curl -i https://woo-combine-backend.onrender.com/api/leagues/me \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE"
```

**Expected Response**:
```
HTTP/2 200 
content-type: application/json
...

{"leagues": [
  {
    "id": "abc123",
    "name": "My League",
    "role": "organizer",
    "created_at": "2024-01-01T00:00:00",
    ...
  }
]}
```

## What Each Response Means

### ✅ 200 with {"leagues": [...]}
**Meaning**: Route works perfectly. Backend is returning correct shape.

### ❌ 404 Not Found
**Meaning**: Route doesn't exist. Possible causes:
- Wrong URL (check prefix: `/api/leagues/me` not `/api/v1/leagues/me`)
- Backend not deployed
- CORS issue (but curl bypasses CORS)

### ❌ 401 Unauthorized
**Meaning**: Token is invalid/expired. Get a fresh token.

### ❌ 500 Internal Server Error
**Meaning**: Backend error. Check backend logs on Render dashboard.

### ❌ 502/503/504
**Meaning**: Backend is cold starting (hibernated). Wait 30-60s and retry.

## Troubleshooting

### "401 Unauthorized"
- Token expired (Firebase tokens expire after 1 hour)
- Get a fresh token from browser console
- Make sure you're copying the full token

### "404 Not Found" 
- Double-check URL: `https://woo-combine-backend.onrender.com/api/leagues/me`
- Verify backend is deployed on Render
- Check Render logs for routing errors

### "Connection refused"
- Backend service might be down
- Check Render dashboard - service should be "Live"

### Takes 30-60 seconds then succeeds
- Normal! Backend was hibernated (Render free tier)
- First request wakes it up
- Subsequent requests will be fast

## Success Criteria

✅ **Route is correct** if you get:
- HTTP 200 status
- JSON response with `{"leagues": [...]}` shape
- Empty array `[]` for new users
- Populated array for existing users

✅ **Contract is consistent** if:
- Always returns object with `leagues` key
- Never returns bare array
- Frontend parsing handles this (already verified)

## Next Steps After Verification

If curl returns `200 {"leagues": []}`:
1. ✅ Backend route exists and works
2. ✅ Response shape is correct
3. ✅ Problem was never routing - it was the 404 for empty state
4. ✅ Our fix (return 200 instead of 404) solves it

If curl returns 404:
1. ❌ Route doesn't exist at that path
2. Check `backend/main.py` for router prefixes
3. Check `backend/routes/leagues.py` for router definition
4. Verify Render deployment succeeded

