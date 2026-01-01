# Production Verification Checklist

After deploying these fixes, verify the following in production:

## 1. New User Flow (Brand New Signup)

### Expected Behavior:
```
1. User signs up → email verification
2. User verifies email → redirected to /select-role
3. User on /select-role page:
   ✅ NO calls to /api/leagues/me (user has no role yet)
   ✅ Backend logs show NO 404s from /leagues/me
4. User selects role (e.g., "League Operator")
5. After role selection → AuthContext fetches leagues:
   ✅ Single call to /api/leagues/me
   ✅ Backend returns: 200 with {"leagues": []} (empty array for new user)
   ✅ NO 404 errors
   ✅ NO retry attempts
6. User proceeds to dashboard/guided setup
```

### What to Check:
- [ ] Backend logs show ZERO 404s from `/api/leagues/me`
- [ ] Network tab shows `/api/leagues/me` called ONCE after role selection
- [ ] Response is `200 OK` with empty leagues array
- [ ] No retry attempts visible in network timing
- [ ] User proceeds smoothly without loading delays

---

## 2. Existing User Login

### Expected Behavior:
```
1. User logs in with existing account
2. AuthContext checks cached role (immediate)
3. If cached role exists:
   ✅ Single call to /api/leagues/me with role
   ✅ Backend returns: 200 with {"leagues": [...]} (user's leagues)
   ✅ Dashboard loads immediately
4. If no cached role:
   ✅ Call /api/users/me first
   ✅ Then call /api/leagues/me with confirmed role
```

### What to Check:
- [ ] `/api/leagues/me` called ONCE per login
- [ ] Response is `200 OK` with leagues array
- [ ] No 404 errors
- [ ] No retry cascade delays
- [ ] Dashboard shows league selection immediately

---

## 3. Error Handling (404 vs 200 Empty)

### Backend Response Patterns:
```
# NEW USER (no leagues):
GET /api/leagues/me
→ 200 OK
→ {"leagues": []}

# EXISTING USER (has leagues):
GET /api/leagues/me  
→ 200 OK
→ {"leagues": [{id: "...", name: "...", role: "..."}]}

# WRONG ENDPOINT (route doesn't exist):
GET /api/v1/leagues/me (wrong prefix)
→ 404 Not Found
→ (This is correct - route actually doesn't exist)
```

### What to Check:
- [ ] "No leagues" state returns `200` not `404`
- [ ] Empty leagues array is treated as valid state
- [ ] No retry logic triggered on `200` responses
- [ ] Real 404s (wrong paths) fail immediately without retries

---

## 4. Retry Logic Verification

### Should Retry (502/503/504 only):
```
Cold start scenarios:
- 502 Bad Gateway → Retries up to 2 times
- 503 Service Unavailable → Retries up to 2 times  
- 504 Gateway Timeout → Retries up to 2 times
- Network timeout (ECONNABORTED) → Retries up to 2 times
```

### Should NOT Retry (4xx errors):
```
Client errors (deterministic - won't succeed on retry):
- 400 Bad Request → Fails immediately, no retry
- 401 Unauthorized → Fails immediately, no retry  
- 403 Forbidden → Fails immediately, no retry
- 404 Not Found → Fails immediately, no retry
```

### What to Check:
- [ ] 404 errors fail immediately (no retry attempts visible)
- [ ] Cold start 502s retry with delays (visible in network timing)
- [ ] Max 2 retry attempts total (not 3+)
- [ ] Retry delays: ~1s, ~2s, ~3s (exponential backoff)

---

## 5. Auth State Machine Flow

### State Transitions:
```
IDLE → INITIALIZING → AUTHENTICATING → FETCHING_CONTEXT → READY

League fetch should ONLY happen when:
1. ✅ firebaseUser exists
2. ✅ token available
3. ✅ /users/me completed (role known)
4. ✅ status === READY or FETCHING_CONTEXT
```

### What to Check:
- [ ] No league fetch during IDLE/INITIALIZING states
- [ ] No league fetch before role is confirmed
- [ ] League fetch happens in READY or FETCHING_CONTEXT only
- [ ] Console logs show proper state progression

---

## 6. Backend Logs Monitoring

### What to Look For:

**Good (Expected):**
```
[GET] /leagues/me called by user: abc123
🚀 Checking user_memberships for user abc123
No leagues found for user abc123 - returning empty array (new user)
→ Status: 200
```

**Bad (Should NOT See):**
```
❌ WARNING: No leagues found for user abc123 in either system
❌ HTTPException: 404 - No leagues found for this user
❌ Multiple /leagues/me calls in rapid succession (retry cascade)
```

### What to Check:
- [ ] Backend logs show "returning empty array" not "HTTPException 404"
- [ ] Single API call per user session
- [ ] No spam/flooding of `/leagues/me` endpoint
- [ ] Clean 200 responses for both empty and populated leagues

---

## 7. Network Tab Analysis (Chrome DevTools)

### New User:
1. Open DevTools → Network tab
2. Sign up → verify email → select role
3. Check requests:
   - [ ] `/api/users/me` → 200 (returns role: null initially)
   - [ ] NO `/api/leagues/me` calls before role selection
   - [ ] After role: `/api/leagues/me` → 200 with `{"leagues": []}`
   - [ ] Timing shows single request (no retries)

### Existing User:
1. Log in with existing account
2. Check requests:
   - [ ] `/api/users/me` → 200 (returns role)
   - [ ] `/api/leagues/me` → 200 with leagues array
   - [ ] Single request (no duplicates)
   - [ ] Fast response (<1s typically, <45s worst-case cold start)

---

## 8. Cold Start Resilience

### Render Cold Start Scenario:
```
Backend hibernates after 15min inactivity
First request takes 30-60s to wake up
```

### Expected Behavior:
```
1. User logs in (backend hibernating)
2. First API call: /users/me
   → Takes 30-60s (cold start)
   → Returns 200 after warmup
3. Second API call: /leagues/me  
   → Fast (<1s, backend already warm)
   → Returns 200
```

### What to Check:
- [ ] First request may take 30-60s (normal for Render free tier)
- [ ] Subsequent requests are fast
- [ ] No retry cascade during cold start
- [ ] User sees loading indicator (not stuck)
- [ ] Eventually succeeds without errors

---

## Summary of Critical Fixes

✅ **Backend**: `/leagues/me` returns `200 {"leagues": []}` not `404` for new users  
✅ **Retry Logic**: Only retries 502/503/504, NOT 4xx errors  
✅ **Auth Guard**: Multi-check readiness (user + token + role + state)  
✅ **State Machine**: Fetches only in READY/FETCHING_CONTEXT states  
✅ **Documentation**: VITE_API_BASE setup guide for Render

## Quick Test Commands

```bash
# Check backend response for new user
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://woo-combine-backend.onrender.com/api/leagues/me

# Should return: {"leagues": []}
# NOT: {"detail": "No leagues found"} with 404
```

