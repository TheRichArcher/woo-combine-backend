# Drill Schema Merge Strategy

**Status:** ✅ DEFENSIVE GUARD IMPLEMENTED (Jan 7, 2025)  
**Location:** `frontend/src/hooks/useDrills.js`

---

## Problem Statement

The frontend needs drill definitions from two sources:

1. **Backend API** (`/events/:id/schema`):
   - Authoritative source for which drills are enabled/disabled
   - May include custom drills added by organizers
   - Currently does NOT include validation metadata (min/max ranges)

2. **Local Templates** (`frontend/src/constants/drillTemplates.js`):
   - Provides validation metadata (min, max, lowerIsBetter)
   - Ensures client-side validation works even if backend is down
   - Source of truth for drill behavior (e.g., "lower is better" for sprint times)

**The Risk:** Backend response can accidentally overwrite local validation fields with `undefined`, breaking validation.

---

## Current Implementation (Defensive Merge)

### Strategy: Whitelist Backend Fields

```javascript
// Start with local template (validation metadata)
const merged = { ...localDrill };

// Backend can ONLY override these specific fields:
if (d.key !== undefined) merged.key = d.key;
if (d.label !== undefined) merged.label = d.label;
if (d.unit !== undefined) merged.unit = d.unit;
if (d.category !== undefined) merged.category = d.category;
if (d.isCustom !== undefined) merged.isCustom = d.isCustom;

// Validation fields: backend wins IF explicitly provided, else keep local
if (d.min !== undefined) merged.min = d.min;
// ... (same for max, lowerIsBetter, defaultWeight)
```

### What This Protects Against

✅ Backend sending `{ key: "sprint_60", label: "60-Yard Sprint" }` (no min/max) → local min/max preserved  
✅ Backend field expansion (new fields won't accidentally overwrite validation)  
✅ Regression if backend schema changes  
✅ Undefined values from snake_case → camelCase conversion issues  

### What This Allows

✅ Backend can override label, unit, category (e.g., for custom drills)  
✅ Backend can provide validation ranges in the future (when implemented)  
✅ Local templates work as fallback if backend is unreachable  

---

## Long-Term Architecture Options

### Option A: Backend as Source of Truth (Recommended)

**Migrate validation metadata to backend:**

1. Add `min_value`, `max_value`, `lower_is_better` to drill schema in Firestore
2. Populate these fields from local templates during event creation
3. Allow organizers to customize validation per event (e.g., adjust ranges for age groups)
4. Frontend treats local templates as **defaults only** during event creation

**Pros:**
- Single source of truth
- Organizers can customize validation per event
- Validation ranges backed up in database
- Easier to update ranges without frontend deployments

**Cons:**
- Requires backend migration
- Risk of data loss if migration is incomplete
- All existing events need backfill

**Migration Path:**
```python
# backend/routes/events.py - Add to event creation
def create_event_with_drill_schema(event_data):
    template = DRILL_TEMPLATES[event_data['drill_template']]
    
    # Populate full drill metadata from frontend templates
    drills_with_validation = []
    for drill in template['drills']:
        drills_with_validation.append({
            'key': drill['key'],
            'label': drill['label'],
            'unit': drill['unit'],
            'min_value': drill.get('min'),      # ← Add validation
            'max_value': drill.get('max'),      # ← Add validation
            'lower_is_better': drill.get('lowerIsBetter', False)
        })
    
    event_data['drills'] = drills_with_validation
    # Save to Firestore...
```

---

### Option B: Keep Local Templates as Source (Current)

**Keep validation metadata in frontend, backend only controls drill list:**

**Pros:**
- ✅ Already implemented
- No backend changes required
- Fast to deploy
- Works offline (client-side validation)

**Cons:**
- Validation ranges hardcoded in frontend
- Can't customize per event
- Requires frontend deploy to update ranges
- Defensive merge code is complex

**When to Use:**
- Validation ranges are truly universal (e.g., 60-yard sprint is 6-10 sec for all events)
- Organizers don't need per-event customization
- Backend team bandwidth is limited

---

## Regression Prevention

### Current Guards

1. **Whitelist merge** in `useDrills.js` (implemented Jan 7, 2025)
2. **Fallback to local templates** if backend fetch fails
3. **Console warning** if drill missing min/max (TODO)

### Recommended Additional Guards

```javascript
// Add to useDrills.js after merge
normalizedDrills.forEach(drill => {
  if (!drill.min || !drill.max) {
    console.warn(
      `[useDrills] Drill ${drill.key} missing validation ranges. ` +
      `Backend: min=${drill.min}, max=${drill.max}. ` +
      `This may cause "null-null" validation messages.`
    );
  }
});
```

### Testing Checklist

Before deploying drill schema changes:

- [ ] Verify all drills have `min` and `max` defined
- [ ] Test validation with out-of-range scores
- [ ] Confirm "Expected range" displays correctly (not `null-null`)
- [ ] Test both API success and API failure paths
- [ ] Verify custom drills inherit validation metadata

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| **Jan 6, 2025** | Added min/max to local templates | Enable client-side validation for Phase 2 |
| **Jan 7, 2025** | Implemented defensive merge | Prevent backend from wiping validation fields |
| **Jan 7, 2025** | Documented long-term options | Allow informed decision on Option A vs B |

**Current Status:** Option B (local templates as source) with defensive guards  
**Recommended Next Step:** Evaluate Option A (backend as source) for Q2 2025 roadmap

---

## Related Documents

- `VALIDATION_BUG_POSTMORTEM.md` - Incident that triggered this defensive pattern
- `frontend/src/constants/drillTemplates.js` - Current validation ranges
- `frontend/src/hooks/useDrills.js` - Merge implementation

---

**Last Updated:** January 7, 2025

