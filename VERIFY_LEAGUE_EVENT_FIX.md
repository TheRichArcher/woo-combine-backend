# Production Verification: League/Event Fix

**Commit:** `67a250e`  
**Deploy Status:** Pushed to main, awaiting Render deployment

---

## 🔍 Verification Checklist

### ✅ Step 1: Backend Response Shape Check

**Goal:** Confirm backend returns BOTH `event_id` AND full `event` object

#### Method A: Browser DevTools (Easiest)

1. Go to https://woo-combine.com
2. Login as organizer
3. Open Browser DevTools (F12) → Network tab
4. Filter: `events`
5. Create a new event
6. Find the POST request to `/leagues/{league_id}/events`
7. Check Response tab

**✅ Expected Response:**
```json
{
  "event_id": "abc123...",
  "event": {
    "id": "abc123...",
    "name": "Test Event",
    "league_id": "xyz789...",
    "drillTemplate": "football",
    "location": "Test Field",
    "date": "2026-01-10",
    "created_at": "2026-01-02T14:30:00Z",
    "disabled_drills": [],
    "live_entry_active": false,
    "notes": ""
  }
}
```

**❌ Old Response (means deploy didn't roll):**
```json
{
  "event_id": "abc123..."
}
```

#### Method B: Backend Logs

1. Go to Render dashboard
2. Navigate to woo-combine-backend service
3. Check Logs tab
4. Create an event in prod
5. Look for log line: `"Created event {id} in league {league_id}"`
6. If you see the log but response is wrong, backend deploy is stale

#### Method C: Direct API Test (with auth token)

```bash
# Get your auth token from browser
# DevTools → Application → Cookies → __session or from localStorage

curl -X POST 'https://woo-combine-backend.onrender.com/leagues/{YOUR_LEAGUE_ID}/events' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "API Test Event",
    "date": "2026-01-10",
    "location": "Test Location",
    "drillTemplate": "football"
  }'
```

**Expected:** JSON with both `event_id` and `event` keys

---

### ✅ Step 2: Frontend State Check

**Goal:** Confirm league context persists when creating multiple events

#### Test Flow:

1. **Start Fresh:**
   - Clear localStorage: DevTools → Application → Local Storage → Clear All
   - Or use Incognito/Private window

2. **Create League:**
   ```
   ✅ Navigate to: /welcome or /create-league
   ✅ Create league: "Test Multi-Event League"
   ✅ Note the league_id from URL or localStorage
   ```

3. **Create First Event (Soccer):**
   ```
   ✅ Create event: "Soccer Tryouts"
   ✅ Template: Soccer ⚽
   ✅ Date: Any future date
   ✅ Location: "Soccer Field"
   ✅ Event should be created
   ✅ Check localStorage → "selectedEvent" → should have league_id field
   ```

4. **Create Second Event (Football):**
   ```
   ✅ Click "Create New Event" button
   ✅ Create event: "Football Camp"
   ✅ Template: Football 🏈
   ✅ Date: Different date
   ✅ Location: "Football Stadium"
   ✅ Event should be created
   ```

5. **Verify League Context Maintained:**
   ```
   ✅ Current page should be /coach dashboard
   ✅ Should NOT see "Create a New League" message
   ✅ Should see normal dashboard with events
   ```

6. **Verify Event Selector:**
   ```
   ✅ Event dropdown should show both events:
      - Soccer Tryouts
      - Football Camp
   ✅ Switch between events
   ✅ Both should load without errors
   ```

7. **Verify localStorage Consistency:**
   ```javascript
   // DevTools → Console → Run:
   const selectedEvent = JSON.parse(localStorage.getItem('selectedEvent'));
   const selectedLeagueId = localStorage.getItem('selectedLeagueId');
   
   console.log('Event league_id:', selectedEvent.league_id);
   console.log('Selected league:', selectedLeagueId);
   console.log('Match:', selectedEvent.league_id === selectedLeagueId);
   ```
   
   **✅ Expected:** All three should show same league_id, Match should be `true`

---

### ✅ Step 3: Multi-Sport Event Switching

**Goal:** Ensure cross-sport events work seamlessly

1. **With both events created:**
   ```
   ✅ Select Soccer event
   ✅ Navigate to /players
   ✅ Note any players (or add test player)
   ✅ Navigate back to dashboard
   ✅ Switch to Football event
   ✅ Navigate to /players
   ✅ Players should be different (event-specific)
   ```

2. **Create Third Event:**
   ```
   ✅ Create Basketball event 🏀
   ✅ Should NOT trigger league creation
   ✅ Should appear in event selector
   ✅ All 3 events should share same league_id
   ```

---

## 🐛 Troubleshooting

### Issue: Backend still returns only `{ event_id }`

**Cause:** Backend deploy hasn't rolled on Render

**Fix:**
1. Check Render dashboard for deployment status
2. Force redeploy if needed: Render → Manual Deploy → Deploy latest commit
3. Wait 2-3 minutes for deployment
4. Clear browser cache and retry

### Issue: "Create a New League" still appears

**Possible Causes:**

1. **Backend not deployed:**
   - Frontend is using fallback `league_id: selectedLeagueId`
   - But some other issue is clearing league context
   - Check browser console for errors

2. **Race condition in AuthContext:**
   - Events are created but `leagues` array is empty when dashboard renders
   - Check: Does `/coach` URL appear briefly before redirect?
   - Check: Any console errors about leagues loading?

3. **EventContext validation issue:**
   - Event has `league_id` but doesn't match `selectedLeagueId`
   - Check EventContext.jsx lines 30-36 for mismatch warnings
   - Look in console for: "Mismatch detected: Event..."

4. **localStorage corruption:**
   - Old events without `league_id` still in storage
   - **Fix:** Clear localStorage completely and retry

### Issue: Events don't appear in selector

**Possible Causes:**

1. **EventContext not loading:**
   - Check network tab for `/leagues/{id}/events` call
   - Should return 200 with events array
   - If 404 or empty, events aren't being fetched

2. **Events in wrong league:**
   - Check each event's `league_id` in Firestore console
   - All should match the league you're viewing

---

## 📊 Success Criteria

| Check | Pass | Fail | Notes |
|-------|------|------|-------|
| Backend returns `event` object | ✅ | ❌ | Response shape correct |
| Backend returns `event.league_id` | ✅ | ❌ | League reference present |
| Frontend uses `response.data.event` | ✅ | ❌ | Code check only |
| localStorage has `league_id` | ✅ | ❌ | Event data complete |
| Create 2+ events works | ✅ | ❌ | No league creation prompt |
| Events share same league | ✅ | ❌ | All have matching league_id |
| Event selector shows all | ✅ | ❌ | All events visible |
| Cross-sport switching works | ✅ | ❌ | No errors when switching |
| /coach loads correctly | ✅ | ❌ | No "Create League" message |

**All checks must be ✅ for fix to be verified.**

---

## 🔧 If Backend Deploy Hasn't Rolled

### Force Render Deployment

```bash
# Option 1: Trigger via Git (empty commit)
cd /Users/richarcher/Desktop/WooCombine\ App
git commit --allow-empty -m "Trigger Render redeploy - verify league/event fix"
git push origin main

# Option 2: Manual Deploy
# Go to Render dashboard → woo-combine-backend → Manual Deploy
```

### Check Render Deployment Status

1. Go to https://dashboard.render.com
2. Click on `woo-combine-backend` service
3. Check "Events" tab for deployment progress
4. Look for: "Deploy succeeded" with commit `67a250e`
5. If stuck on old commit, click "Manual Deploy"

---

## 📝 Report Template

After testing, fill this out:

```
## Verification Report: League/Event Fix

**Date:** [Date/Time]
**Tester:** [Your name]
**Environment:** Production (woo-combine.com)

### Backend Response Check
- [ ] Backend returns `event_id`: YES / NO
- [ ] Backend returns `event` object: YES / NO
- [ ] `event.league_id` is present: YES / NO
- Response shape: [Paste JSON response]

### Frontend Flow Check
- [ ] Created first event (sport: _____)
- [ ] Created second event (sport: _____)
- [ ] /coach showed "Create League": YES / NO (should be NO)
- [ ] Both events appear in selector: YES / NO
- [ ] localStorage `selectedEvent.league_id` present: YES / NO
- [ ] All events share same league_id: YES / NO

### Issues Encountered
[Describe any problems]

### Console Errors
[Paste any relevant console errors]

### Render Deployment Status
- Current commit: [commit hash from Render]
- Expected commit: 67a250e
- Deployment status: [In Progress / Succeeded / Failed]

### Overall Result
- [ ] ✅ FIX VERIFIED - All checks passed
- [ ] ❌ FIX FAILED - [Describe what's wrong]
- [ ] ⏳ PENDING - Backend deployment in progress
```

---

## 🎯 Quick Verification (30 seconds)

**Fastest way to check if fix is live:**

1. Open https://woo-combine.com
2. Login as organizer
3. Open DevTools Network tab
4. Create any event
5. Check POST `/events` response

**If response has `event` object → ✅ Backend deployed**  
**If response only has `event_id` → ❌ Backend NOT deployed**

Then test the UI flow to verify frontend is working correctly.

