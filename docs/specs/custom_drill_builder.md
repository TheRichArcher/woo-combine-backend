# Custom Drill Builder – UX & Flow Spec

This document defines the approved user experience, guardrails, and end-to-end flow for the Custom Drill Builder. It covers both placement points (Event Setup wizard and Admin Tools → “Manage Drills”), outlines wireframes, and details validation/locking rules so implementation can proceed without ambiguity.

---

## 1. Placement & Entry Points

### Event Setup (pre–live entry)
- Surface a “Create Custom Drill” option within the drill configuration step of the Event Setup wizard.
- Prominently message that drills can be edited until Live Entry begins; thereafter they become read-only.
- Once a custom drill is saved, it appears in the setup summary list alongside template drills (with a “Custom” badge).

### Admin Tools → Manage Drills
- Add a “Manage Drills” section with two tabs:
  - `Template Drills` (read-only reference)
  - `Custom Drills` (per-event list with edit/duplicate/remove actions, subject to lock state)
- “New Custom Drill” button launches the same wizard as Event Setup.
- Display lock status when Live Entry has started (disabled buttons + tooltip: “Locked after Live Entry started for this event”).

---

## 2. Wireframes (ASCII)

### 2.1 Event Setup Step (compact launch)
```
┌──────────────────────────────────────────────┐
│ Step 3 · Configure Drills                    │
├──────────────────────────────────────────────┤
│ [Built-in Drill List …]                      │
│                                              │
│ ┌─────────────── Custom Options ───────────┐ │
│ │ Need something different?                │ │
│ │ Create a drill unique to this event.     │ │
│ │                                          │ │
│ │ [Create Custom Drill]  (lock note)       │ │
│ │ “Editable until Live Entry begins.”      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [Back]                            [Continue] │
└──────────────────────────────────────────────┘
```

### 2.2 Admin Tools → Manage Drills
```
┌──────────────────────────────────────────────┐
│ Manage Drills                                │
├──────────────┬───────────────────────────────┤
│ Template     │ Custom (Event: Spring Combine)│
└──────────────┴───────────────────────────────┘
│ [New Custom Drill]    Live Entry: Not Started │
│------------------------------------------------
│ Name          Unit   Category   Status  Actions │
│ 40m Shuttle   sec    Speed      Custom  [Edit]  │
│ Vertical Tap  in     Athletic   Custom  [Edit]  │
│                                                │
│ (Lock indicator appears once Live Entry starts) │
└────────────────────────────────────────────────┘
```

### 2.3 Wizard Modal (shared)
```
┌──────────────────────────────────────────────┐
│ Create Custom Drill • Step X of 4            │
├──────────────────────────────────────────────┤
│ (Stepper: Basics → Direction & Unit → Range →│
│  Preview & Confirm)                          │
│                                              │
│ [Form fields for current step]               │
│                                              │
│ <Back                         Continue>      │
└──────────────────────────────────────────────┘
```

---

## 3. Wizard Steps & Validation

| Step | Purpose | Fields & Rules |
|------|---------|----------------|
| 1. Basics | Collect essential identifiers | Drill Name (required, 4–40 chars), Category (predefined list, required), Description (optional helper text), Visibility note (“Event-scoped only”). |
| 2. Direction & Unit | Ensure scoring orientation aligns with normalization | Unit dropdown (mph, sec, ft/in, reps, points, %, “Other” + free text), Direction toggle (“Higher is better” vs “Lower is better”, required). Unit selection sets later input masks and placeholders. |
| 3. Range & Validation | Capture min/max for 0–500 normalization + sanity warnings | Expected Min/Max (required numeric inputs, decimal support). Validate min < max, apply unit-aware hints. Soft validation: if ranges fall outside heuristics (e.g., sprint > 120 sec), show warning modal with confirm checkbox “I understand this range is unusual” before continuing. |
| 4. Preview & Confirm | Show scoring safety net | Display example scores (e.g., 3 sample values evenly spread between min/max). Show resulting normalized 0–500 scores with direction note. Include “Edit” links for prior steps. Final confirmation text: “Custom drills lock once Live Entry begins.” Save button finalizes creation. |

### Validation Details
- Every step allows Continue only when required inputs pass validation.
- Wizard state persists if user closes modal mid-way (until they explicitly cancel).
- “Other Unit” text field limited to 20 chars, sanitized to prevent special characters that break CSV headers.
- Range heuristics (examples):
  - Sprint/time: warn if max > 120 sec.
  - Vertical jump (inches/cm): warn if outside 5–80 in / 10–200 cm.
  - Percent: enforce 0–100 inclusive.
  - Reps/points: warn if max > 500.
- Warning modal pattern:
  1. Show detected issue.
  2. Provide quick rationale.
  3. Require explicit “Proceed anyway” confirmation.

---

## 4. Guardrails & Locking Behavior

- **Lock trigger:** Once Live Entry status for the event flips to “Active,” all custom drills for that event become read-only. UI disables Edit/Delete buttons and shows tooltip “Locked because Live Entry has started.”
- **Scope:** Custom drills belong exclusively to the event they were created in. Copying events can optionally duplicate associated custom drills (future enhancement).
- **Data integrity:** Backend should store `lowerIsBetter`, unit, category, min, max, and metadata (`createdBy`, timestamps, locked flag).
- **Entry validation:** During live scoring, the unit metadata drives input masks:
  - `sec`, `mph`, `points`, `reps`: numeric with decimal support.
  - `%`: clamp 0–100.
  - `ft/in`: two-field input or instruct to convert to inches (decision TBD; for v1, recommend single numeric inches to avoid complex parsing).
  - Custom “Other” unit defaults to generic numeric input but still enforces min/max boundaries.
- **Normalization:** All calculations reuse the existing normalization utility to produce 0–500 scores. Direction toggle flips the interpolation (lower value = higher score when `lowerIsBetter = true`).
- **Exports & rankings:** Custom drills:
  - Appear in Players page sliders, weighting controls, and analytics exactly like template drills (with default weight = evenly distributed unless user adjusts).
  - Generate CSV columns using the drill name (sanitized snake_case). Ordering follows the configured drill list for the event.

---

## 5. Detailed User Flows

### 5.1 Event Setup Flow
1. Organizer reaches “Configure Drills” step.
2. Clicks “Create Custom Drill.”
3. Completes Steps 1–4 of wizard.
4. On Save:
   - Drill added to event drill list and shown with a “Custom” badge.
   - Wizard closes, step summary refreshes.
5. Prior to starting Live Entry, organizer can reopen Manage Drills (within setup) to edit/delete custom drills.
6. When Live Entry begins, builder entry point remains but buttons show “Locked (Live Entry started).”

### 5.2 Admin Tools Flow
1. Organizer opens Admin Tools → Manage Drills.
2. `Custom Drills` tab lists existing custom drills for selected event.
3. Actions available (pre-lock):
   - Edit (reopens wizard with fields prefilled).
   - Duplicate (optional v1, otherwise omit).
   - Delete (with confirmation).
4. “New Custom Drill” launches wizard identical to Event Setup version.
5. If Live Entry active:
   - New/Edit/Delete buttons disabled.
   - Inline banner explains locking rule and points users to create new drills in future events instead.

---

## 6. Future Considerations (Out of Scope for v1)
- Custom categories or tagging system.
- mm:ss or ss.ms formatted inputs.
- Global drill templates reusable across events/sports.
- Drag-and-drop ordering within Manage Drills (v1 can use simple move up/down if needed).
- Analytics showing usage of each custom drill.

---

**Success criteria recap**
- Wizard enforces required fields, direction choice, and validated ranges.
- Soft validation prevents common extreme mistakes while allowing purposeful overrides.
- Custom drills seamlessly integrate with normalization, exports, rankings, and sliders.
- Locking prevents mid-event changes, preserving scoring integrity.
- Feature lives in both Event Setup and Admin Tools, respecting event scope.

