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

## At-Risk Components (Fragile State Patterns)
The following components were checked for undeclared `loading`/`error` variables in JSX. They currently appear safe but should be monitored during refactors:
- `CreateEventModal.jsx` (FIXED)
- `EditEventModal.jsx` (Safe)
- `JoinLeague.jsx` (Safe)
- `CreateLeague.jsx` (Safe)
- `DrillInputForm.jsx` (Safe - uses `useAsyncOperation`)
- `AddPlayerModal.jsx` (Safe - uses `useAsyncOperation`)
