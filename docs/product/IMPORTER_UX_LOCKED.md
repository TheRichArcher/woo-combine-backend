# 🔒 Importer Required Fields UX - LOCKED

**Status:** Canonical Implementation  
**Commit:** 80fb72c  
**Date Locked:** January 3, 2026

---

## Policy

**Importer Required Fields UX (Commit 80fb72c) is canonical.**

**No changes without PM sign-off.**

---

## Rationale

The Import Results modal Review step has been comprehensively solved:

1. ✅ **P0 UX failure resolved** - Required field mapping now explicit and discoverable
2. ✅ **Success criteria validated** - Users can fix name errors in < 5 seconds
3. ✅ **Production-ready** - Cold user tests pass without hand-holding
4. ✅ **Over-engineered (intentionally)** - Progressive disclosure, auto-detection, error guidance

**This area is now over-solved.** Further iteration risks:
- Introducing regressions
- Diminishing returns on polish
- Distraction from higher-leverage areas

---

## What Is Locked

### UI Structure
- STEP 1: Required Fields panel (always visible, pinned at top)
- STEP 2: Drill scores mapping (table headers)
- Progressive disclosure (gated workflow)
- Visible-but-disabled table until Step 1 complete

### Name Mapping Pattern
- Two explicit modes via radio buttons:
  - Separate First + Last columns
  - Single Full Name (auto-split)
- Auto-detection from CSV columns
- Manual override always available

### Validation Flow
- Hard block on Import until name mapping valid
- Scroll + highlight on error
- Disabled Import button visual state

---

## When Changes Are Allowed

**Approved scenarios (do NOT require PM sign-off):**

1. **Bug fixes** - If importer crashes or validation fails incorrectly
2. **Accessibility** - Screen reader support, keyboard navigation
3. **Localization** - Translation of existing labels (no structural changes)
4. **Performance** - If import takes >5 seconds for reasonable file sizes

**Requires PM sign-off:**

1. Adding/removing required fields
2. Changing validation rules
3. Restructuring UI layout (panels, steps, etc.)
4. Removing auto-detection logic
5. Adding new mapping modes

**Absolutely blocked:**

1. "Simplifying" by hiding the Required Fields panel
2. Moving name mapping back into column headers
3. Removing progressive disclosure
4. Auto-proceeding without explicit name mapping

---

## If Real Users Fail

**Before making changes:**

1. Reproduce the exact failure scenario
2. Document with screenshots/video
3. Confirm it's a structural issue, not user error or documentation gap
4. Get PM approval for proposed fix

**Acceptable fixes:**
- Clearer error messaging
- Better default selections in dropdowns
- Improved auto-detection heuristics

**Not acceptable:**
- Removing validation steps
- Hiding controls
- Auto-mapping without user confirmation

---

## Related Documentation

- Implementation: `/docs/reports/IMPORT_REQUIRED_FIELDS_UX_FIX.md`
- Code: `/frontend/src/components/Players/ImportResultsModal.jsx`
- Commit: 80fb72c

---

## Next High-Leverage Areas

**Focus development on:**

1. **Coach dashboard** → "Next Action" follow-through
2. **First-event success metrics** → Time to first ranking
3. **Export/share flows** → Where value is realized

**Do not iterate on importer** unless real users fail it with production data.

