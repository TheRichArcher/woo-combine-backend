# CORS Preflight Fix for Event Deletion (P0 Hotfix)

**Date**: January 5, 2026  
**Severity**: P0 - Blocking all production deletions  
**Status**: ✅ Fixed

---

## Problem

Event deletion was failing in production with CORS preflight errors:

```
blocked by CORS policy: Response to preflight request doesn't pass access control check
OPTIONS /api/leagues/{league_id}/events/{event_id} -> 400 Bad Request
```

**Root Cause**: Browser sends OPTIONS preflight for DELETE requests with custom headers, but backend was returning 400 instead of 200.

---

## Why This Happened

When we added custom headers for deletion validation:
- `X-Delete-Target-Event-Id` (required)
- `X-Delete-Intent-Token` (optional)

The browser started sending CORS preflight (OPTIONS) requests before the actual DELETE.

**Two Issues Identified**:

1. **Missing CORS Header Configuration**
   - CORSMiddleware didn't know about our custom headers
   - `allow_headers` list was missing deletion headers

2. **Missing OPTIONS Handler**
   - No explicit OPTIONS route for the DELETE endpoint
   - Decorators (@require_permission, @write_rate_limit) were blocking OPTIONS
   - CORSMiddleware alone wasn't sufficient

---

## The Fix (3 Changes)

### 1. Updated CORS Configuration (backend/main.py)

**Before**:
```python
allow_headers=[
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Requested-With",
    "X-Abuse-Nonce",
    "X-Abuse-Answer",
],
```

**After**:
```python
allow_headers=[
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Requested-With",
    "X-Abuse-Nonce",
    "X-Abuse-Answer",
    "X-Delete-Target-Event-Id",     # Event deletion validation
    "X-Delete-Intent-Token",        # One-time-use token
],
```

### 2. Added Explicit OPTIONS Handler (backend/routes/events.py)

```python
@router.options('/leagues/{league_id}/events/{event_id}')
def delete_event_preflight(
    league_id: str = Path(..., regex=r"^.{1,50}$"), 
    event_id: str = Path(..., regex=r"^.{1,50}$")
):
    """
    CORS preflight handler for DELETE endpoint.
    Returns 200 OK to allow browser to proceed with actual DELETE request.
    CORSMiddleware adds the necessary headers automatically.
    """
    return Response(status_code=200)
```

**Why This Works**:
- No decorators = no permission/rate limit checks on OPTIONS
- Returns 200 immediately
- CORSMiddleware adds proper headers automatically

### 3. Added Response Import (backend/routes/events.py)

```python
from fastapi import APIRouter, Depends, HTTPException, Request, Path, Query, Response
```

---

## Testing

### Quick Acceptance Test (DevTools → Network)

**Expected Behavior**:

1. **OPTIONS Request** (Preflight):
   ```
   OPTIONS /api/leagues/{league_id}/events/{event_id}
   Status: 200 OK
   
   Response Headers:
   Access-Control-Allow-Origin: https://woo-combine.com
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   Access-Control-Allow-Headers: ..., X-Delete-Target-Event-Id, X-Delete-Intent-Token, ...
   ```

2. **DELETE Request** (Actual):
   ```
   DELETE /api/leagues/{league_id}/events/{event_id}
   Status: 200 OK
   
   Request Headers:
   X-Delete-Target-Event-Id: {event_id}
   X-Delete-Intent-Token: {jwt_token}
   ```

### Manual Test Steps

1. Open production site (woo-combine.com)
2. Navigate to Admin Tools
3. Initiate event deletion (3-layer flow)
4. Open DevTools → Network tab
5. Complete deletion confirmation
6. Verify:
   - OPTIONS request returns 200
   - DELETE request fires immediately after
   - Event is deleted successfully

---

## Why We Need Both Fixes

### Why CORS Header Configuration Alone Wasn't Enough

Even with proper `allow_headers`, the OPTIONS request was still hitting the DELETE route handler because:
- Decorators run before the function body
- `@require_permission` checks for `current_user` (doesn't exist for OPTIONS)
- This raises 401/400 before CORSMiddleware can return 200

### Why OPTIONS Handler Alone Wasn't Enough

Without adding headers to `allow_headers`:
- Browser would reject the response
- Even if OPTIONS returns 200, browser would see missing headers
- Actual DELETE would be blocked by browser

**Both fixes are required** for CORS preflight to work correctly.

---

## Prevention

### For Future Custom Headers

When adding ANY custom header to requests:

1. ✅ Add to `allow_headers` in CORSMiddleware (backend/main.py)
2. ✅ Add explicit OPTIONS handler if route has decorators
3. ✅ Test in production with DevTools Network tab
4. ✅ Verify preflight returns 200 before actual request

### Common Custom Header Patterns

| Header Type | Requires Preflight | Needs OPTIONS Handler |
|-------------|-------------------|----------------------|
| `Authorization: Bearer ...` | ❌ No | ❌ No |
| `Content-Type: application/json` | ❌ No | ❌ No |
| `X-Custom-Header: ...` | ✅ Yes | ✅ Yes (if decorated) |
| `X-API-Key: ...` | ✅ Yes | ✅ Yes (if decorated) |

---

## Deployment

**Urgency**: Deploy immediately - blocking all production deletions

**Steps**:
1. Commit changes
2. Push to main
3. Render auto-deploys backend
4. Verify OPTIONS returns 200 in production
5. Test deletion flow end-to-end

**Rollback**: If issues, revert commit (deletion was already broken, no worse state)

---

## Related Documentation

- CORS Middleware: https://fastapi.tiangolo.com/tutorial/cors/
- CORS Preflight: https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request
- FastAPI OPTIONS: https://fastapi.tiangolo.com/tutorial/path-operation-configuration/

---

## Commit Message

```
hotfix: Add CORS preflight support for event deletion endpoint (P0)

CRITICAL: Event deletion was failing with CORS preflight 400 errors

ROOT CAUSE: Browser sends OPTIONS preflight for DELETE requests with
custom headers (X-Delete-Target-Event-Id, X-Delete-Intent-Token), but
backend was returning 400 instead of 200.

TWO ISSUES IDENTIFIED:
1. CORSMiddleware missing deletion headers in allow_headers
2. No explicit OPTIONS handler (decorators blocking preflight)

═══════════════════════════════════════════════════════════════════════════════
FIX #1: Updated CORS Configuration (backend/main.py)
═══════════════════════════════════════════════════════════════════════════════

Added custom deletion headers to allow_headers:
- X-Delete-Target-Event-Id (required validation header)
- X-Delete-Intent-Token (optional one-time-use token)

This allows browser to include these headers after preflight succeeds.

═══════════════════════════════════════════════════════════════════════════════
FIX #2: Added Explicit OPTIONS Handler (backend/routes/events.py)
═══════════════════════════════════════════════════════════════════════════════

Created @router.options() handler for the DELETE endpoint:
- No decorators (no permission/rate limit checks)
- Returns 200 immediately
- CORSMiddleware adds proper headers automatically

WHY BOTH FIXES NEEDED:
- Header config alone: Decorators still block OPTIONS with 401/400
- OPTIONS handler alone: Browser rejects without allow_headers
- Both together: Preflight succeeds, DELETE fires correctly

═══════════════════════════════════════════════════════════════════════════════
TESTING
═══════════════════════════════════════════════════════════════════════════════

Quick acceptance test in DevTools Network:
1. OPTIONS returns 200 with proper CORS headers
2. DELETE fires immediately after preflight
3. Event deletion succeeds

Expected:
OPTIONS /api/leagues/{id}/events/{id} -> 200 OK
  Access-Control-Allow-Headers includes X-Delete-*
DELETE /api/leagues/{id}/events/{id} -> 200 OK
  Includes X-Delete-Target-Event-Id + X-Delete-Intent-Token

═══════════════════════════════════════════════════════════════════════════════
IMPACT
═══════════════════════════════════════════════════════════════════════════════

Before: All deletion attempts blocked by CORS
After: Deletion flow works correctly with custom headers

Severity: P0 - Blocking all production deletions
Deploy: Immediately

Related: Bulletproof deletion system (6d65bee, b79f0f2, 89b9332)
```

---

**Status**: ✅ Ready for immediate deployment

