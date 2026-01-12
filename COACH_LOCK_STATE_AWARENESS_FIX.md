# Coach Lock State Awareness - Real-Time UX Fix

**Date:** January 11, 2026  
**Priority:** P1 - Critical UX Issue  
**Status:** ✅ READY FOR DEPLOYMENT

---

## Problem Statement

### User-Reported Issue

**Organizer lock works correctly** - Admin UI updates immediately after locking  
**Coach experience is confusing:**
- Coach page shows "unlocked" until manual refresh
- Submit attempts fail with generic "Error submitting score"
- No indication that combine was locked by organizer
- Coaches don't understand why submissions are failing

**Impact:** Coaches waste time re-entering scores, confused about permissions, contact organizer unnecessarily

---

## Root Cause

**Backend enforcement works perfectly** - Returns 403 Forbidden when locked  
**Frontend awareness is missing:**
1. No real-time lock state monitoring
2. No visual indication of lock status
3. Generic error handling doesn't detect lock-specific 403s
4. Inputs remain enabled even when locked

---

## Solution Implemented

### 1. New Hook: `useCombineLockState.js`

**Real-time lock state monitoring:**
```javascript
- Polls event lock state every 15 seconds
- Re-checks on window focus (user returns to tab)
- Detects 403 lock errors from submission attempts
- Provides lock state + helper functions to components
```

**Features:**
- `isLocked` - Current combine lock boolean
- `lockMessage` - User-friendly lock explanation
- `checkLockState()` - Manual lock state refresh
- `handleSubmitError(error)` - Analyzes errors for lock-related 403s

### 2. New Component: `CombineLockedBanner.jsx`

**Prominent lock indicator:**
```jsx
🔒 Combine Locked [READ-ONLY badge]
- Clear message: "Results are final and cannot be edited"
- Action guidance: "Contact organizer if corrections needed"
- Red gradient design (visually distinct)
```

### 3. Enhanced LiveEntry Component

**Integrated lock awareness:**
```javascript
// Real-time monitoring
const { isLocked: combineIsLocked, lockMessage, handleSubmitError } = useCombineLockState();

// Banner display
<CombineLockedBanner isLocked={combineIsLocked} message={lockMessage} />

// Disabled inputs when locked
<input disabled={isCurrentDrillLocked || combineIsLocked} />
<button disabled={loading || isCurrentDrillLocked || combineIsLocked} />

// Smart error handling
catch (error) {
  const { isLockError, userMessage } = await handleSubmitError(error);
  showError(userMessage); // "Combine is locked" not "Error submitting"
}
```

---

## User Experience Flow

### Before Fix (Confusing)

```
Organizer locks combine
    ↓
Coach still sees "unlocked" UI
    ↓
Coach enters score + submits
    ↓
Generic error: "Error submitting score"
    ↓
Coach confused, tries again
    ↓
Same error
    ↓
Coach refreshes page
    ↓
NOW sees it's locked (too late)
```

### After Fix (Clear)

```
Organizer locks combine
    ↓
Within 15 seconds, coach's page auto-detects lock
    ↓
🔒 RED BANNER appears: "Combine Locked"
    ↓
Score inputs disabled
    ↓
Submit button disabled + shows "Combine Locked"
    ↓
IF coach somehow submits before poll detects lock:
    - Gets 403 error
    - Hook immediately detects + shows banner
    - Error message: "Combine is locked. Contact organizer."
    ↓
No wasted effort, clear next steps
```

---

## Technical Implementation

### Lock State Polling

**Lightweight background checks:**
```javascript
useEffect(() => {
  // Initial check
  checkLockState();
  
  // Poll every 15 seconds
  const interval = setInterval(checkLockState, 15000);
  
  return () => clearInterval(interval);
}, [selectedEvent?.id]);
```

**Window focus detection:**
```javascript
useEffect(() => {
  const handleFocus = () => {
    // Only check if >5s since last check (prevents spam)
    if (Date.now() - lastCheck > 5000) {
      checkLockState();
    }
  };
  
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [checkLockState, lastCheck]);
```

### Error Detection

**Analyzes 403 responses:**
```javascript
const handleSubmitError = async (error) => {
  const status = error.response?.status;
  const detail = error.response?.data?.detail || '';

  // Lock-specific 403 detection
  const isLockError = 
    status === 403 && 
    (detail.includes('locked') || 
     detail.includes('final') || 
     detail.includes('cannot be edited'));

  if (isLockError) {
    await checkLockState(); // Immediate refresh
    return {
      isLockError: true,
      userMessage: 'Combine is locked. Contact organizer for corrections.'
    };
  }

  // Generic error
  return { isLockError: false, userMessage: 'Error submitting score. Try again.' };
};
```

---

## Files Changed

### New Files (3)

1. **`frontend/src/hooks/useCombineLockState.js`** (143 lines)
   - Real-time lock state monitoring hook
   - Polling + focus detection + error analysis
   
2. **`frontend/src/components/CombineLockedBanner.jsx`** (37 lines)
   - Reusable lock status banner component
   - Red gradient + clear messaging

3. **Documentation** (this file)

### Modified Files (1)

1. **`frontend/src/pages/LiveEntry.jsx`**
   - Import lock state hook + banner component
   - Add banner to UI (line ~1063)
   - Disable inputs when `combineIsLocked` is true
   - Enhanced error handling with `handleSubmitError()`

---

## Testing Checklist

### Manual Testing Required

#### Test 1: Lock Detection (No Submission)

1. Login as coach, open LiveEntry page
2. As organizer in separate window, lock the combine
3. **Wait 15 seconds** (or switch away and back to coach tab)
4. **Expected:** Red lock banner appears automatically
5. **Expected:** Score inputs become disabled
6. **Expected:** Submit button shows "Combine Locked"

#### Test 2: Lock Detection (During Submission)

1. Login as coach, open LiveEntry page
2. Enter player number + score (don't submit yet)
3. As organizer, lock the combine
4. **Immediately** click Submit (before poll detects lock)
5. **Expected:** 
   - Error message: "Combine is locked. Contact organizer..."
   - Lock banner appears immediately
   - Inputs become disabled

#### Test 3: Unlock Detection

1. With combine locked and coach seeing lock banner
2. As organizer, unlock the combine
3. **Wait 15 seconds** on coach page
4. **Expected:**
   - Lock banner disappears
   - Inputs become enabled
   - Submit button becomes active

#### Test 4: Window Focus Refresh

1. Login as coach, open LiveEntry
2. Switch to different browser tab for 10+ seconds
3. As organizer, lock the combine
4. Switch back to coach tab
5. **Expected:** Lock banner appears within ~2 seconds (focus trigger)

---

## Performance Considerations

### Polling Frequency

**15-second interval chosen because:**
- Light enough to not impact performance (1 GET request every 15s)
- Fast enough for good UX (coach notices within reasonable time)
- Can be adjusted if needed (change `15000` to other value)

### Focus Detection Throttling

**5-second throttle prevents:**
- Rapid duplicate checks when quickly switching tabs
- Unnecessary API load from tab-switching spam
- Still responsive for normal usage patterns

### Error-Triggered Checks

**Immediate check on 403 errors:**
- Fastest possible lock detection
- Only triggers when actually needed
- Provides instant feedback to coach

---

## Future Enhancements

### WebSocket Lock Notifications (Ideal)

**Instead of polling, use real-time push:**
```javascript
// When organizer locks combine
socket.emit('combine-locked', { eventId, leagueId });

// All connected coaches receive instantly
socket.on('combine-locked', () => {
  setIsLocked(true);
  showBanner();
});
```

**Benefits:**
- Instant notification (0 delay)
- No polling overhead
- Scales better for many users

**Trade-offs:**
- Requires WebSocket infrastructure
- More complex deployment
- Current polling solution works well for now

---

## Acceptance Criteria

### ✅ Lock Detection

- [ ] Coach sees lock banner within 15 seconds of organizer locking
- [ ] Coach sees lock banner immediately on window focus
- [ ] Coach sees lock banner immediately after failed submit (403)

### ✅ UI Disable

- [ ] Score input disabled when locked
- [ ] Player number input disabled when locked
- [ ] Submit button disabled when locked
- [ ] Submit button text changes to "Combine Locked"

### ✅ Error Messages

- [ ] Lock-related 403 shows: "Combine is locked. Contact organizer..."
- [ ] Other errors show generic: "Error submitting score. Try again."
- [ ] No confusing generic errors for lock situations

### ✅ Unlock Detection

- [ ] Lock banner disappears within 15 seconds of unlock
- [ ] Inputs re-enable after unlock detection
- [ ] Submit button re-enables after unlock

---

## Deployment

### Build Status

**Frontend:** ✅ Built successfully
```
✓ 3185 modules transformed
dist/assets/index-FgXshuD6.js (1.93 MB gzipped: 549 KB)
✓ built in 12.42s
```

### Commit & Push

```bash
cd /Users/richarcher/Desktop/WooCombine\ App
git add frontend/src/hooks/useCombineLockState.js
git add frontend/src/components/CombineLockedBanner.jsx
git add frontend/src/pages/LiveEntry.jsx
git commit -m "feat: real-time combine lock awareness for coaches

Coaches now see immediate feedback when combine is locked:
- Real-time lock state monitoring (15s polling + focus detection)
- Prominent lock banner with clear messaging
- Disabled inputs when locked
- Smart error detection for lock-related 403s

Eliminates confusion from generic 'Error submitting' messages.
Coaches understand immediately why submissions are blocked."

git push origin main
```

---

## Rollback Plan

**If issues arise:**
```bash
git revert HEAD
git push origin main
```

**Hook can be disabled by commenting out:**
```javascript
// const { isLocked: combineIsLocked, lockMessage, handleSubmitError } = useCombineLockState();
const combineIsLocked = false;
const lockMessage = '';
const handleSubmitError = async (error) => ({ isLockError: false, userMessage: 'Error' });
```

---

**Status:** ✅ Ready for Production Deployment  
**Risk Level:** 🟢 Low - Additive feature, no breaking changes  
**User Impact:** 🟢 High - Significantly improves coach UX during locked state

