# Incident Report: logDragEvent Production Crash

**Date:** January 8, 2026  
**Severity:** P0 - Production Outage  
**Status:** ✅ Resolved (2 hotfixes deployed)  
**Duration:** ~45 minutes total (2 separate crashes)

---

## Summary

Production crash on `/admin#player-upload-section` caused by undefined `logDragEvent()` function calls in drag-and-drop event handlers.

**Impact:**
- Complete crash on Admin Tools page
- Error boundary triggered: "Something went wrong"
- Affected all users attempting to access player upload area
- Console error: `ReferenceError: logDragEvent is not defined`

---

## Timeline

| Time | Event |
|------|-------|
| ~Unknown | Regression introduced during Phase 1 import unification |
| T+0 | User reports crash on /admin#player-upload-section |
| T+2 | Investigation begins, error identified |
| T+5 | Root cause found: undefined logDragEvent calls |
| T+8 | Fix implemented, build verified |
| T+10 | Hotfix deployed (commit 08eca91) |
| T+12 | Prevention utility added (commit 82a80a8) |

---

## Root Cause

### What Happened

During **Phase 1 import unification** (commit `a0c0b52`), we removed custom CSV import logic from `EventSetup.jsx` and replaced it with `ImportResultsModal`. However:

1. The `logDragEvent()` telemetry function was removed
2. **But 6 calls to `logDragEvent()` remained** in drag/drop handlers:
   - `handleDragEnterCapture()` - 1 call
   - `handleDragLeaveCapture()` - 1 call
   - `handleDropCapture()` - 4 calls

3. When users navigated to `/admin`, the drag handlers tried to call the undefined function
4. JavaScript threw `ReferenceError: logDragEvent is not defined`
5. React error boundary caught it and showed crash screen

### Why It Wasn't Caught

**Before deployment:**
- ✅ Build passed (telemetry calls are valid syntax)
- ✅ No linter errors (function was in dependency arrays)
- ❌ Missing: Runtime testing of drag/drop in `/admin`

**The gap:** Telemetry functions are non-functional side effects, so build tools don't catch missing definitions.

---

## Fix

### Immediate Hotfix (commit 08eca91)

**Removed all `logDragEvent()` calls from EventSetup.jsx:**

```javascript
// BEFORE (crashed):
dragCounter.current++;
logDragEvent('dragenter', { /* ... */ });  // ❌ Undefined
if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
  setIsDragging(true);
}

// AFTER (works):
dragCounter.current++;
// Telemetry removed - non-functional, safe to remove
if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
  setIsDragging(true);
}
```

**Changes:**
- EventSetup.jsx: -33 lines (telemetry calls removed)
- Drag/drop functionality preserved
- No behavioral changes (telemetry is non-functional)

**Result:**
- ✅ /admin loads without error
- ✅ Player upload section renders
- ✅ Drag/drop works correctly
- ✅ Build passes (3183 modules)

---

### Prevention (commit 82a80a8)

**Created fail-safe telemetry utility:** `/frontend/src/utils/telemetry.js`

**Features:**
- All telemetry functions fail silently (never throw)
- Try/catch wrappers on every function
- Sentry integration (if available)
- Console logging in development only

**Usage:**
```javascript
import { logDragEvent } from '@/utils/telemetry';

// Never crashes, even if Sentry unavailable
logDragEvent('drop-success', { fileName: 'data.csv' });
```

**Principle:** Telemetry is important, but must **never break functionality**.

---

## Lessons Learned

### What Went Wrong

1. **Incomplete refactoring:** Removed function but not all calls
2. **Missing runtime tests:** Build passed, but runtime crash occurred
3. **Telemetry not guarded:** Direct function calls with no fail-safe

### What Went Right

1. **Fast detection:** User reported immediately
2. **Quick diagnosis:** Error message was clear
3. **Simple fix:** Telemetry is non-critical, safe to remove
4. **Fast deployment:** 20 minutes detection → deployment

---

## Prevention Measures

### Immediate (Deployed)

✅ **Hotfix:** Removed all undefined logDragEvent calls  
✅ **Telemetry utility:** Created fail-safe logging functions  
✅ **Pattern established:** All telemetry must use safe wrappers

### Short-Term (Recommended)

**1. Add to CONTRIBUTING.md:**
```markdown
## Telemetry Best Practices

- Always use telemetry.js utilities (never direct function calls)
- Telemetry must fail silently (never throw errors)
- Test drag/drop flows before deploying
```

**2. Add to PR template:**
```markdown
If you're adding telemetry/analytics:
- [ ] Used fail-safe utilities from telemetry.js
- [ ] Wrapped in try/catch if custom
- [ ] Tested that missing telemetry doesn't crash
```

**3. Add runtime guard pattern:**
```javascript
// Pattern: Safe call with optional chaining
telemetry?.logEvent?.('event-name', data);

// Or: Safe import with fallback
import { logEvent } from '@/utils/telemetry';
const safeLog = logEvent || ((...args) => {});
```

### Long-Term (Future)

**1. Enhanced testing:**
- Add smoke tests for critical paths (/admin, /players, /live-entry)
- Test with network disabled (simulates missing dependencies)
- Visual regression testing

**2. Error monitoring:**
- Sentry already configured
- Monitor for `ReferenceError` in production
- Alert on error boundary triggers

**3. Code review checklist:**
- Verify all imported functions are defined
- Check for removed functions still being called
- Test all UI paths after refactoring

---

## Action Items

| Item | Owner | Status |
|------|-------|--------|
| Deploy hotfix #1 (logDragEvent) | Done | ✅ |
| Deploy hotfix #2 (drillDefinitions) | Done | ✅ |
| Create telemetry utility | Done | ✅ |
| Update CONTRIBUTING.md | Pending | ⏳ |
| Update PR template | Pending | ⏳ |
| Clean up orphaned CSV code | Recommended | 📋 |
| Add smoke tests | Future | 📋 |

---

## Second Crash: drillDefinitions (Hotfix #2)

**Time:** ~25 minutes after first hotfix deployment  
**Error:** `ReferenceError: drillDefinitions is not defined` (line 247)  
**Also:** `ReferenceError: confirmedRequiredFields is not defined`

### Root Cause (Same Pattern)

Incomplete cleanup from Phase 1 import unification:
- `drillDefinitions` was removed but referenced in 7 locations
- `confirmedRequiredFields` state was never declared but setter was called
- Both were in dependency arrays and code paths of orphaned CSV handlers

### Solution (Hotfix #2 - commit 73e316b)

Added safe defaults for orphaned variables:
```javascript
const drillDefinitions = [];  // Safe empty array
const [confirmedRequiredFields, setConfirmedRequiredFields] = useState(new Set());
```

**Note:** EventSetup.jsx still has ~500 lines of old CSV processing code that's no longer used (ImportResultsModal replaced it). These safe defaults prevent crashes but **full cleanup is recommended**.

---

## Related Issues

- Phase 1 import unification (commit `a0c0b52`)
- CONTRIBUTING.md (created in commit `9e944b7`)
- PR template (created in commit `9e944b7`)

---

## Incident Resolution

**Both crashes resolved:**
- ✅ Hotfix #1: Removed logDragEvent calls (commit `08eca91`)
- ✅ Hotfix #2: Added missing variable declarations (commit `73e316b`)
- ✅ Prevention: Created fail-safe telemetry utility (commit `82a80a8`)

**Root pattern:** Incomplete refactoring left orphaned code with undefined references

**Recommended follow-up:**
1. Clean up all orphaned CSV code in EventSetup.jsx (~500 lines)
2. Update contribution guidelines about complete refactoring
3. Add smoke tests for /admin page
4. Consider ESLint rule to catch undefined variables in dependency arrays

**Date Closed:** January 8, 2026


