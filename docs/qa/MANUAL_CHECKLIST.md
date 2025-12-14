# Manual QA Checklist

## Coach Dashboard - Event Creation
- [ ] **Create New Event (Zero State)**
    - [ ] Log in as organizer with a league that has 0 events.
    - [ ] Verify "Create Your First Event" modal appears automatically or via button.
    - [ ] Fill out form and submit.
    - [ ] **Verify**: No white screen/crash. Event is created and selected.

- [ ] **Create New Event (Existing Events)**
    - [ ] Log in as organizer with existing events.
    - [ ] Click "Create New Event".
    - [ ] **Verify**: Modal opens correctly.
    - [ ] Create event.
    - [ ] **Verify**: Dashboard updates to show new event.

- [ ] **League Switching**
    - [ ] Start in League A. Open "Create New Event" modal. Cancel.
    - [ ] Switch to League B. Click "Create New Event".
    - [ ] **Verify**: Modal reflects League B context (no crash).

- [ ] **Error Handling**
    - [ ] Attempt to create event with network disconnected (or mock failure).
    - [ ] **Verify**: User sees in-UI error message. App does not crash.

## Player Import (Organizer)
- [ ] **Happy Path (CSV)**
    - [ ] Navigate to "Admin Tools" or "Players" -> "Import Players".
    - [ ] Upload a valid CSV (Name, Number, Age Group, 40 Yard Dash).
    - [ ] Map columns in the UI.
    - [ ] **Verify**: Success modal shows correct count. Players appear in list. Scores appear in Analytics.

- [ ] **Error Scenarios**
    - [ ] Upload a file with missing headers.
    - [ ] **Verify**: "Mapping" step warns about missing required fields.
    - [ ] Upload a file with common synonym headers (e.g. "Jersey #", "Division").
    - [ ] **Verify**: System auto-maps "Jersey #" to "Number" and "Division" to "Age Group".
    - [ ] Upload a file with duplicate players (same name/number).
    - [ ] **Verify**: System handles duplicates (updates or skips, based on logic) without crashing.
    - [ ] **Verify**: App displays a readable error message, not a raw 500/stack trace.

## Team Formation
- [ ] **Snake Draft**
    - [ ] Go to "Team Formation" tab.
    - [ ] Select "Snake Draft", set number of teams (e.g., 4).
    - [ ] Click "Generate Teams".
    - [ ] **Verify**: Teams are generated. Players are distributed evenly.

- [ ] **Balanced Mode**
    - [ ] Select "Balanced" mode.
    - [ ] Click "Generate Teams".
    - [ ] **Verify**: Teams have roughly equal "Average Score".
    - [ ] **Sanity Check**: Ensure no single team has ALL the top players.

## At-Risk Components (Fragile State Patterns)
The following components were checked for undeclared `loading`/`error` variables in JSX. They currently appear safe but should be monitored during refactors:
- `CreateEventModal.jsx` (FIXED)
- `EditEventModal.jsx` (Safe)
- `JoinLeague.jsx` (Safe)
- `CreateLeague.jsx` (Safe)
- `DrillInputForm.jsx` (Safe - uses `useAsyncOperation`)
- `AddPlayerModal.jsx` (Safe - uses `useAsyncOperation`)
