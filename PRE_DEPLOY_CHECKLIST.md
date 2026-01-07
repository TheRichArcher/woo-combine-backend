# Pre-Deploy Checklist

**Purpose**: Catch production-breaking issues before deployment  
**Required For**: All PRs touching core user flows  
**Time Required**: ~5 minutes

---

## ✅ Required Checks (All Must Pass)

### 1. Production Build Verification

```bash
cd frontend
npm run build
```

**Must pass with:**
- ✅ Zero build errors
- ✅ All modules transformed successfully
- ✅ No critical warnings (chunk size warnings are acceptable)

**If this fails:** Fix build errors before proceeding. Do not deploy.

---

### 2. Production Preview Test

```bash
npm run preview
```

**Then test in browser:**
- Open http://localhost:4173
- Verify the application loads without console errors
- Check browser console for any runtime errors

**If this fails:** Fix runtime errors. Production will crash the same way.

---

### 3. Smoke Test Critical Paths

**For changes touching these areas, test the full flow:**

#### Live Entry (`/live-entry`)
- [ ] Login as organizer/coach
- [ ] Navigate to `/live-entry`
- [ ] **Page loads without crash** (most critical)
- [ ] Select a drill
- [ ] Enter 1 score for a player
- [ ] Click "Edit Last" → verify pre-fills
- [ ] Enter duplicate score → verify modal appears
- [ ] Click drill switch → verify confirmation (if entries exist)
- [ ] Verify score saves successfully

**Time**: ~2 minutes  
**Prevents**: TDZ errors, component crashes, broken submission flow

#### Player Import (`/admin` → CSV Upload)
- [ ] Navigate to Admin Tools
- [ ] Upload CSV file with players
- [ ] Verify mapping interface loads
- [ ] Verify preview shows correct data
- [ ] Import players
- [ ] Verify players appear in roster

**Time**: ~2 minutes  
**Prevents**: Import crashes, mapping failures, data corruption

#### Authentication Flow
- [ ] Logout
- [ ] Login with email/password
- [ ] Verify redirect to dashboard
- [ ] Select league
- [ ] Select event
- [ ] Navigate to any protected route

**Time**: ~2 minutes  
**Prevents**: Auth loops, routing failures, permission issues

#### Ranking System (`/players`)
- [ ] Navigate to Players page
- [ ] Verify rankings calculate and display
- [ ] Adjust weight sliders
- [ ] Verify rankings update in real-time
- [ ] Apply preset weights
- [ ] Export CSV

**Time**: ~2 minutes  
**Prevents**: Calculation errors, infinite loops, export failures

---

## 🔍 ESLint Verification

```bash
npm run lint
```

**Must pass with:**
- ✅ Zero errors
- ⚠️ Warnings acceptable (but review them)

**Common issues caught:**
- `no-use-before-define`: Functions used before declaration (TDZ errors)
- `no-unused-vars`: Unused imports/variables
- `react-hooks/exhaustive-deps`: Missing hook dependencies

---

## 📋 Specific Checks by Feature Area

### Adding New Routes
- [ ] Route definition exists in `App.jsx`
- [ ] RequireAuth wrapper if needed
- [ ] Navigation links updated
- [ ] Deep linking works (refresh on route)

### Modifying Context Providers
- [ ] No circular dependencies
- [ ] useCallback/useMemo have correct deps
- [ ] Loading states handled
- [ ] Error states handled

### Adding New Hooks/Effects
- [ ] All dependencies listed
- [ ] No infinite loops
- [ ] Cleanup functions for subscriptions
- [ ] No stale closures

### API Changes
- [ ] Backend endpoint exists
- [ ] Request/response format matches
- [ ] Error handling in place
- [ ] Loading states shown
- [ ] Cache invalidation if needed

---

## ⚠️ Red Flags (Do NOT Deploy)

Stop and fix immediately if you see:

- ❌ **Build fails** - Production will not work
- ❌ **Console errors in preview** - Production will crash the same way
- ❌ **ESLint errors** - Code quality issues, potential runtime bugs
- ❌ **White screen on load** - Critical component crash
- ❌ **"Cannot access X before initialization"** - TDZ error (like incident dd0449e)
- ❌ **Infinite loops in console** - useEffect dependency issues
- ❌ **404s on navigation** - Missing route definitions
- ❌ **Auth redirects loop** - Permission/routing logic broken

---

## 🚀 Quick Reference Commands

```bash
# Full pre-deploy sequence (run from project root)
cd frontend
npm run lint          # Check code quality
npm run build         # Build for production
npm run preview       # Test production build locally

# Then open http://localhost:4173 and test critical paths
```

**Total time**: ~5-10 minutes including smoke tests

---

## 📝 Deployment Sign-Off Template

```
Pre-Deploy Checklist Complete:
✅ Build passes (npm run build)
✅ Preview loads (npm run preview)
✅ Smoke tests completed: [list paths tested]
✅ ESLint passes (npm run lint)
✅ No console errors in production preview
✅ Critical path verified: [specific flow]

Ready for production deploy.
```

---

## 🔧 Troubleshooting Common Issues

### Build Fails with "X is not defined"
- Check imports at top of file
- Verify the module exports the symbol
- Check for typos in import names

### Preview Crashes with TDZ Error
- Search for the variable name in the file
- Find where it's declared (const/let/function)
- Ensure declaration appears BEFORE any usage
- Consider moving to top of component or using function declarations

### ESLint Errors on `no-use-before-define`
- Move function definitions before their usage
- OR wrap in `useCallback` if used in hooks
- OR use function declarations (`function X(){}`) which ARE hoisted

### Preview Shows White Screen
- Open browser console (F12)
- Look for error message
- Fix the component causing the crash
- Re-build and re-test

---

## 📚 Related Documentation

- [Hotfix TDZ Incident](./HOTFIX_TDZ_INCIDENT.md) - Example of what this checklist prevents
- [Phase 1 Deployment](./PHASE_1_DEPLOYMENT_SUMMARY.md) - Feature deployment summary
- [Phase 2 Deployment](./PHASE_2_DEPLOYMENT_SUMMARY.md) - Feature deployment summary

---

**Remember**: 5 minutes of pre-deploy testing prevents hours of production debugging.

The TDZ incident (dd0449e) would have been caught in step 2 (preview test) if this checklist had been followed. Let's not repeat it.

