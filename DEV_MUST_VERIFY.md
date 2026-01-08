# DEV TEAM: REQUIRED VERIFICATION

**DO NOT MARK AS COMPLETE UNTIL THIS CHECKLIST IS EXECUTED BY A DEVELOPER**

**DO NOT ASK USER TO TEST - DEV MUST VERIFY AND PROVIDE PROOF**

---

## What Was Implemented

### Safari-Specific Optimizations
1. ✅ `dropEffect = 'copy'` set on dragenter AND dragover
2. ✅ `effectAllowed = 'copy'` set for Safari compatibility
3. ✅ `role="button"` and `tabIndex={0}` on drop zone
4. ✅ `webkit-user-select: none` to prevent Safari hit-testing issues
5. ✅ `draggable={false}` on all buttons
6. ✅ `pointerEvents: 'none'` on buttons during drag
7. ✅ Capture-phase handlers (onDragOverCapture, onDropCapture)
8. ✅ Window-level safety net
9. ✅ Production telemetry with Sentry

### Build Info
- **Commit SHA:** Will be shown in commit after this file
- **Bundle timestamp:** `1767905135389`
- **File:** `index-BmhFmEVM-1767905135389.js`

---

## MANDATORY TESTING PROTOCOL

### 1. Safari macOS Testing (REQUIRED)

**Device:**
- Mac computer
- Safari version: _____ (paste from Safari → About Safari)
- macOS version: _____ (Apple menu → About This Mac)

**Test Steps:**
1. Navigate to: `https://woo-combine.com/admin#player-upload-section`
2. Hard refresh: Cmd+Shift+R
3. Open DevTools: Cmd+Option+C
4. Console tab → Filter for: `[DRAG-TELEMETRY]`
5. Verify you see: `[DRAG-TELEMETRY] dropzone-mounted`
6. Paste `window.__WOOCOMBINE_BUILD__` in console
7. Take screenshot of console output showing build SHA
8. Drag a CSV file from desktop
9. Drop it OVER THE BUTTONS (hardest case)
10. Verify upload starts and CSV processes

**Evidence Required:**
- [ ] Screenshot of `window.__WOOCOMBINE_BUILD__` output
- [ ] Screenshot of dropzone-mounted telemetry
- [ ] Screen recording (QuickTime: Cmd+Shift+5) showing:
  - Dragging CSV from desktop
  - Dropping over button area
  - Success toast appearing
  - CSV data loading
- [ ] Paste full telemetry from console (dragenter through drop-success)

**Upload Recording:**
- Save to: `docs/qa/safari-dragdrop-proof-[date].mov`
- File size should be < 10MB (compress if needed)

---

### 2. Windows Chrome/Edge Testing (REQUIRED)

**Device:**
- Windows version: _____ (Settings → System → About)
- Browser: _____ (Chrome or Edge)
- Browser version: _____ (Help → About)

**Test Steps:**
1. Navigate to: `https://woo-combine.com/admin#player-upload-section`
2. Hard refresh: Ctrl+Shift+R
3. Open DevTools: F12
4. Console tab → Filter for: `[DRAG-TELEMETRY]`
5. Verify you see: `[DRAG-TELEMETRY] dropzone-mounted`
6. Paste `window.__WOOCOMBINE_BUILD__` in console
7. Take screenshot of console output
8. Drag a CSV file from File Explorer
9. Drop it over the dropzone
10. Verify upload starts

**Evidence Required:**
- [ ] Screenshot of `window.__WOOCOMBINE_BUILD__` output
- [ ] Screenshot of dropzone-mounted telemetry
- [ ] Screen recording (Windows Game Bar: Win+G) showing:
  - Dragging CSV from File Explorer
  - Dropping over drop zone
  - Success toast appearing
  - CSV data loading
- [ ] Paste full telemetry from console

**Upload Recording:**
- Save to: `docs/qa/windows-dragdrop-proof-[date].mp4`

---

### 3. Click-to-Upload Regression Test (REQUIRED)

**All Browsers:**
1. Click green "Upload CSV" button
2. File picker should open
3. Select CSV file
4. Verify upload works

**Evidence:**
- [ ] Screenshot showing file picker opened
- [ ] Screenshot showing successful upload

---

### 4. Sentry Telemetry Verification (REQUIRED)

**Sentry Dashboard:**
1. Go to: https://sentry.io/[your-org]/[your-project]
2. Search for breadcrumbs with category: `drag-drop`
3. Find event with message: `dropzone-mounted`
4. Find event with message: `drop` where `filesLength: 1`

**Evidence Required:**
- [ ] Screenshot of Sentry breadcrumb showing `dropzone-mounted`
- [ ] Screenshot of Sentry breadcrumb showing `drop` with file details
- [ ] Paste Sentry event link (internal team access only)

---

### 5. Failure Diagnosis (IF TESTS FAIL)

**If Safari Still Doesn't Work:**

Check console for telemetry and report:
```
Dropzone mounted: [yes/no]
Dragenter fired: [yes/no]
Dragover fired: [yes/no]
Drop fired: [yes/no]
defaultPrevented on drop: [true/false]
filesLength in drop event: [number]
```

**Common Safari Issues:**
- If dragenter fires but drop doesn't → Something blocking drop
- If drop fires but filesLength=0 → DataTransfer not accessible
- If no telemetry at all → Bundle not deployed / stale cache

**Next Steps If Failed:**
1. Capture full console output
2. Check Network tab for bundle timestamp
3. Try in Safari Private Window (no cache)
4. Document exact failure mode

---

## ACCEPTANCE CRITERIA (NON-NEGOTIABLE)

This ticket is NOT DONE until:

- [ ] Dev tested in Safari macOS - drag-and-drop works
- [ ] Dev tested in Windows Chrome OR Edge - drag-and-drop works
- [ ] Dev tested click-to-upload still works (both browsers)
- [ ] Dev provided video recordings (uploaded to repo)
- [ ] Dev provided console screenshots with build SHA visible
- [ ] Dev verified Sentry breadcrumbs visible
- [ ] All evidence committed to: `docs/qa/DRAGDROP_VERIFICATION_[date].md`

---

## TESTING TIMELINE

**Target:** Within 4 hours of deployment
**Deadline:** Before marking task complete
**Responsibility:** Development team (NOT end user)

---

## EVIDENCE SUBMISSION

Create file: `docs/qa/DRAGDROP_VERIFICATION_2026-01-08.md`

Include:
```markdown
# Drag-and-Drop Verification - January 8, 2026

## Build Verified
- Commit SHA: [paste]
- Build timestamp: [paste]
- Bundle file: [paste]

## Safari macOS
- Version: [paste]
- Video: [link to .mov file]
- Console output: [paste]
- Result: ✅ PASS / ❌ FAIL

## Windows Chrome/Edge
- Version: [paste]
- Video: [link to .mp4 file]
- Console output: [paste]
- Result: ✅ PASS / ❌ FAIL

## Click-to-Upload
- Safari: ✅ PASS / ❌ FAIL
- Windows: ✅ PASS / ❌ FAIL

## Sentry Telemetry
- dropzone-mounted visible: ✅ / ❌
- drop event visible: ✅ / ❌
- Event link: [paste]

## Tested By
- Name: [your name]
- Date: [date/time]
- Environment: Production (woo-combine.com)

## Sign-Off
I confirm drag-and-drop works as specified and have provided video proof.

Signature: _________________________
```

---

## DO NOT SKIP THIS

**This is not optional.**

**This is not "when we have time."**

**This must be done before closing the drag-and-drop issue.**

User should be able to drag-and-drop CSV files without debugging.

---

## Questions?

**Q: Can I ask the user to test?**  
A: No. Dev tests and provides proof.

**Q: What if I don't have a Windows machine?**  
A: Use a VM, BrowserStack, or ask a teammate with Windows.

**Q: What if I don't have time right now?**  
A: Then the ticket isn't done. Don't mark as complete.

**Q: The telemetry shows it should work, isn't that enough?**  
A: No. Video proof of actual drag-and-drop required.

**Q: Can I just test in one browser?**  
A: No. Safari macOS + Windows Chrome/Edge required per acceptance criteria.

---

## Commit This Evidence

```bash
git add docs/qa/DRAGDROP_VERIFICATION_2026-01-08.md
git add docs/qa/safari-dragdrop-proof.mov
git add docs/qa/windows-dragdrop-proof.mp4
git commit -m "QA: Drag-and-drop verified in Safari macOS and Windows Chrome"
git push
```

Then notify team: "Drag-and-drop verified and working in production."

