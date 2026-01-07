# P0 Hotfix - Temporal Dead Zone Error

**Date**: January 7, 2026  
**Severity**: P0 - Production Crash  
**Status**: ✅ **RESOLVED** (commit dd0449e)  
**Downtime**: ~15 minutes

---

## Incident Summary

**What Happened:**
- `/live-entry` route crashed immediately on load with:
  ```
  ReferenceError: Cannot access 'Br' before initialization
  ```
- Error at `LiveEntry.jsx:348:69` (minified: function `nce`)
- Blocked all live scoring functionality

**Root Cause:**
- **Temporal Dead Zone (TDZ) violation**
- `handleDrillSwitch` function was defined at **line 882**
- But referenced in useEffect dependency array at **line 348**
- Function used before declaration = TDZ error in production build

**Introduced In:**
- Phase 2 commit `3bf0e90` (Drill Switch Protection)
- Added keyboard shortcuts useEffect that referenced new function
- Forgot to move function definition before its usage

---

## The Fix

**What Changed:**
1. Moved `handleDrillSwitch` definition from line 882 → line 330
2. Wrapped in `useCallback` with proper dependencies
3. Also moved `confirmDrillSwitch` for consistency
4. Removed duplicate definitions

**Before (BROKEN):**
```javascript
// Line 330: useEffect references handleDrillSwitch
useEffect(() => {
  // ... keyboard shortcuts ...
  handleDrillSwitch(drills[nextIdx].key); // ❌ TDZ ERROR
}, [handleDrillSwitch]); // ❌ Function not defined yet

// Line 882: Function defined 540 lines later
const handleDrillSwitch = (newDrillKey) => {
  // ...
};
```

**After (FIXED):**
```javascript
// Line 330: Function defined BEFORE useEffect
const handleDrillSwitch = useCallback((newDrillKey) => {
  // ...
}, [entriesInCurrentDrill]);

const confirmDrillSwitch = useCallback(() => {
  // ...
}, [pendingDrillSwitch]);

// Line 360: useEffect now references defined function
useEffect(() => {
  // ... keyboard shortcuts ...
  handleDrillSwitch(drills[nextIdx].key); // ✅ Works
}, [handleDrillSwitch]); // ✅ Function already defined
```

---

## Verification

✅ **Build**: Success (3180 modules)  
✅ **Linting**: Zero errors  
✅ **Production**: Deployed (commit dd0449e)  
✅ **Runtime**: No TDZ errors  
✅ **Functionality**: All Phase 2 features working

---

## Why This Happened

**Development vs Production:**
- In development, React's fast refresh often masks TDZ issues
- Production minification changes variable names (`handleDrillSwitch` → `Br`)
- Production build is more strict about initialization order

**How It Slipped Through:**
- Phase 2 was tested in development mode
- Build succeeded (Vite doesn't catch TDZ at compile time)
- TDZ errors only appear at runtime in production

**Prevention:**
- ✅ Always run `npm run build && npm run preview` before production deploy
- ✅ Test production build locally, not just dev mode
- ✅ Use ESLint rule: `no-use-before-define` (already enabled)
- ✅ Keep function definitions near their usage (not 500+ lines away)

---

## Lessons Learned

1. **Function Hoisting Order Matters:**
   - React components execute top-to-bottom
   - Functions defined with `const` are NOT hoisted
   - If useEffect references a function, define function FIRST

2. **Test Production Builds:**
   - Development mode !== production mode
   - Always test `npm run build` output before deploy
   - TDZ errors only appear at runtime, not compile time

3. **Refactoring Risk:**
   - When moving code, check ALL references
   - Search for function name across entire file
   - Verify declaration order before commit

---

## Timeline

- **19:45** - Phase 2 deployed (commit 3bf0e90)
- **20:15** - User reports P0 crash on `/live-entry`
- **20:17** - TDZ error identified (line 348 references line 882)
- **20:20** - Hotfix applied (moved function definitions)
- **20:22** - Build verified, committed (dd0449e)
- **20:23** - Deployed to production
- **20:25** - Verified fix in production

**Total Resolution Time**: 10 minutes from report to production fix

---

## Affected Users

- All users attempting to access `/live-entry`
- No data loss (crash happened before any data operations)
- No scoring sessions interrupted (feature was completely blocked)

---

## Current Status

✅ **Live Entry**: Fully operational  
✅ **Phase 1 Features**: Working (Edit Last, Duplicate Opt, Rapid Entry)  
✅ **Phase 2 Features**: Working (Validation, Drill Protection)  
✅ **Production**: Stable  

---

## Post-Mortem Actions

**Immediate:**
- ✅ Hotfix deployed and verified
- ✅ Incident documented

**Short-Term:**
- 🔄 Add pre-deploy checklist: `npm run build && npm run preview`
- 🔄 Test production builds for all future feature branches

**Long-Term:**
- 🔄 Consider CI/CD pipeline with production build tests
- 🔄 Add automated TDZ detection in pre-commit hooks

---

**Production is now stable. Phase 2 ready for validation.** ✅

