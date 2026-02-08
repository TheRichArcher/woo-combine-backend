# Production Verification Checklist

After deploying these fixes, verify the following in production:

## 🔍 The 3-Network-Call Fingerprint (CRITICAL TEST)

This is the **definitive test** that proves everything works correctly.

### For a Brand-New User (After Login):

Open Chrome DevTools → Network tab, filter for "Fetch/XHR", then log in as a new user:

```
✅ CORRECT FLOW:
1. GET /api/users/me → 200 OK, {"role": null, ...}
2. [User redirected to /select-role page]
3. [NO /api/leagues/me call visible yet] ← CRITICAL
4. [User selects role, e.g., "League Operator"]
5. GET /api/leagues/me → 200 OK, {"leagues": []}
6. [User proceeds to dashboard/guided setup]

❌ WRONG FLOW (Guard not working):
1. GET /api/users/me → 200 OK, {"role": null, ...}
2. GET /api/leagues/me → ??? ← SHOULD NOT HAPPEN
   ^ If you see this before role selection, guard is broken
```

### What This Proves:

- ✅ `/api/users/me` happens first (role check)
- ✅ NO `/leagues/me` before role selection (guard works)
- ✅ `/api/leagues/me` happens AFTER role (proper gating)
- ✅ Response is 200 with `{"leagues": []}` (not 404)
- ✅ No retry attempts (single clean call)

### For an Existing User (With Leagues):

```
✅ CORRECT FLOW:
1. GET /api/users/me → 200 OK, {"role": "organizer", ...}
2. GET /api/leagues/me → 200 OK, {"leagues": [{...}, {...}]}
3. [Dashboard loads with leagues]

Total: 2 API calls
```

---

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

### The 3-Call Fingerprint Test (Most Important)

**New User - Step by Step**:
1. Open DevTools → Network tab → Filter: Fetch/XHR
2. Clear network log (🚫 icon)
3. Sign up → verify email → wait for redirect
4. **Check**: Should see ONLY `GET /api/users/me` → 200
5. **Check**: Should see NO `/api/leagues/me` calls yet
6. **Verify**: Page shows role selection UI
7. Select a role (e.g., "League Operator")
8. **Check**: NOW see `GET /api/leagues/me` → 200 with `{"leagues": []}`
9. **Verify**: Single request, no retries visible in timing

**What to Check**:
- [ ] Call #1: `/api/users/me` → 200 (role: null)
- [ ] NO `/api/leagues/me` before role selection
- [ ] Call #2: `/api/leagues/me` → 200 after role selection
- [ ] Response body: `{"leagues": []}`
- [ ] Timing shows single request (no retry attempts)
- [ ] Total network calls: 2 (not 3, not 5, not 10+)

### Existing User:
### Existing User (With Leagues):
1. Clear network log  
2. Log in with existing account
3. **Check**: See `/api/users/me` → 200 (role present)
4. **Check**: See `/api/leagues/me` → 200 with leagues array
5. **Verify**: Single request (no duplicates)
6. **Verify**: Fast response (<1s typically, <45s worst-case cold start)

**What to Check**:
- [ ] Call #1: `/api/users/me` → 200 (role: "organizer" or similar)
- [ ] Call #2: `/api/leagues/me` → 200 with `{"leagues": [...]}`
- [ ] No duplicate `/api/leagues/me` calls (de-duplication works)
- [ ] Dashboard loads with league data

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

