# Phase 2 Production Sanity Test Checklist

**URL:** https://woo-combine.com  
**Test Date:** _________  
**Tester:** _________  
**Status:** ⏳ Pending

---

## Purpose

Quick human verification that Phase 2 canonical components work correctly in production.

---

## Test 1: Delete Confirmation Modal (Medium Severity)

**Feature:** Custom drill deletion  
**Path:** Admin Tools → Drill Manager → Custom Drills tab → Delete drill

**Steps:**
1. Navigate to Admin Tools
2. Click on "Drill Manager" or create a custom drill
3. Find a custom drill in the list
4. Click the trash icon (🗑️) to delete

**Expected Behavior:**
- [ ] DeleteConfirmModal appears (white modal, centered)
- [ ] Title says "Delete Custom Drill"
- [ ] Shows drill name in description
- [ ] Shows consequences message
- [ ] "Delete Drill" button is enabled (no typed confirmation needed for medium severity)
- [ ] Click "Delete Drill" → button shows "Deleting..." with spinner
- [ ] Success toast appears: "✅ Drill deleted successfully"
- [ ] Modal closes automatically
- [ ] Drill is removed from list immediately
- [ ] No page refresh needed

**Pass Criteria:** All checkboxes ✓

---

## Test 2: Undo Confirmation Modal (Low Severity)

**Feature:** Undo last entry in Live Entry mode  
**Path:** Live Entry → Enter a score → Click Undo

**Steps:**
1. Navigate to Live Entry mode
2. Select a drill
3. Enter a player number and score
4. Submit the entry
5. Click the "Undo" button (⏮️) for the last entry

**Expected Behavior:**
- [ ] DeleteConfirmModal appears (yellow/warning theme)
- [ ] Title says "Undo Entry"
- [ ] Shows player name in description
- [ ] No typed confirmation required (low severity)
- [ ] "Undo Entry" button is enabled immediately
- [ ] Click "Undo Entry" → button shows "Deleting..."
- [ ] Success toast appears: "✅ Entry deleted successfully"
- [ ] Modal closes automatically
- [ ] Recent entries list updates (entry removed)
- [ ] No page refresh needed

**Pass Criteria:** All checkboxes ✓

---

## Test 3: Player Cards - Players Page

**Path:** /players (all tabs)

### Tab 1: Player Management & Rankings

**Steps:**
1. Navigate to /players
2. Ensure "Player Management & Rankings" tab is active
3. Scroll through player list

**Expected Behavior:**
- [ ] All players display using PlayerCard component (card variant)
- [ ] Each card shows:
  - [ ] Avatar with initials (gradient blue/purple)
  - [ ] Player name (bold, gray-900)
  - [ ] Player number (#123)
  - [ ] Age group
- [ ] Action buttons visible:
  - [ ] Eye icon (View Stats & Weights) - hover turns blue
  - [ ] Edit icon (Edit Player) - hover turns green
- [ ] Spacing consistent between cards (gap-2 or similar)
- [ ] "Add Result" button below each card (teal/brand color)

**Empty State:**
- [ ] If no players: Shows "No players found. Add some players to get started!"

---

### Tab 2: Export & Reports (Rankings & Analysis)

**Steps:**
1. Click "Export & Reports" tab
2. Scroll to rankings section

**Expected Behavior:**
- [ ] Top 5 players display using PlayerCard (compact variant)
- [ ] Each card shows:
  - [ ] Rank number on left (1-5)
  - [ ] Player name
  - [ ] Player number
  - [ ] Composite score on right (blue, bold)
- [ ] Cards are clickable (cursor pointer)
- [ ] Clicking opens PlayerDetailsModal
- [ ] Spacing very compact (minimal padding)
- [ ] Consistent typography

---

### Tab 3: Live Rankings (if visible)

**Steps:**
1. Adjust weight sliders
2. Observe top 10 players list

**Expected Behavior:**
- [ ] Players display using PlayerCard (compact variant)
- [ ] Rank numbers 1-10 visible
- [ ] Weighted scores update in real-time
- [ ] Same compact spacing as Rankings tab
- [ ] No action buttons (just display)

---

## Test 4: Player Cards - Coach Dashboard

**Path:** /coach-dashboard (or /rankings)

**Steps:**
1. Navigate to Coach Dashboard / Rankings page
2. Select an age group
3. View rankings list

**Expected Behavior:**
- [ ] All ranked players use PlayerCard (compact variant)
- [ ] Rank numbers visible (1, 2, 3, ...)
- [ ] Top 3 show medal emojis (🥇🥈🥉) - should NOT appear anymore (unified rendering)
- [ ] Player names displayed
- [ ] Jersey numbers displayed
- [ ] Composite scores displayed (right side, teal color)
- [ ] Cards are clickable
- [ ] Clicking opens player details
- [ ] Spacing consistent with Players page compact cards

**Visual Consistency Check:**
- [ ] Compare side-by-side with /players Rankings tab
- [ ] Spacing should be identical
- [ ] Font sizes should match
- [ ] Colors should match (blue scores)

---

## Test 5: Empty & Loading States

### Empty State

**Steps:**
1. Create a new event with zero players
2. Navigate to /players

**Expected Behavior:**
- [ ] Shows PlayerCardEmpty component
- [ ] Message: "No players found. Add some players to get started!"
- [ ] Centered, gray text
- [ ] No broken layouts

### Loading State (Optional - may be too fast to see)

**Steps:**
1. Navigate to /players with slow network (throttle in DevTools)

**Expected Behavior:**
- [ ] PlayerCardSkeleton components appear
- [ ] Gray animated pulse effect
- [ ] Same layout as actual cards
- [ ] Smooth transition to real cards

---

## Overall Consistency Check

**Cross-Page Comparison:**
- [ ] Player cards on /players look identical to Coach Dashboard
- [ ] Action buttons appear in same location (right side)
- [ ] Avatar styling consistent (gradient, initials)
- [ ] Typography matches (font weights, sizes)
- [ ] Spacing feels uniform
- [ ] No "slightly different" player card variants visible

---

## Acceptance Criteria

**To pass sanity test, ALL must be true:**
✅ Delete drill modal works (medium severity)  
✅ Undo entry modal works (low severity)  
✅ Player cards render consistently across all pages  
✅ Empty states work  
✅ Action buttons work (View/Edit)  
✅ No visual inconsistencies  
✅ No broken layouts  
✅ No console errors  

---

## Failure Protocol

**If any test fails:**
1. Document exact failure (screenshot + steps)
2. Check browser console for errors
3. Note which canonical component failed
4. Create bug report with:
   - Test number
   - Expected vs actual behavior
   - Browser/OS
   - Console errors
5. Roll back if critical
6. Fix and re-test

---

## Sign-Off

**Tester Signature:** _________________  
**Date:** _________________  
**Status:** ☐ PASS | ☐ FAIL | ☐ BLOCKED  

**Notes:**
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

**If all tests pass:** Phase 2 is production-verified ✅  
**Next:** Ship product features with confidence


