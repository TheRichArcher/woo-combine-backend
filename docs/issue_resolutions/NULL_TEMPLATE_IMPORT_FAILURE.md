# Incident Resolution: Silent 0-Score CSV Imports

## Problem Description
Users reported successful CSV uploads of player rosters where drill scores were present in the CSV but resulted in "0 scores" saved in the database. Analytics showed players with no data.

## Root Cause Analysis
1. **Null Drill Template:** The specific event had its `drillTemplate` field set to `null` (explicit null) in Firestore, rather than a string like "football" or "soccer".
2. **Backend Crash:** The backend's `SchemaRegistry.get_schema()` method blindly attempted to call `.lower()` on the input string. When passed `None` (from the null template), it raised an exception, causing the `/events/{id}/schema` endpoint to return a 500 error.
3. **Frontend Silent Failure:** The frontend component (`AdminTools.jsx`) caught this error but handled it by setting the list of drill definitions to an empty array `[]` without notifying the user.
4. **Roster-Only Import:** The CSV mapping logic, seeing 0 drill definitions, presented the user with a "Map Fields" interface containing *only* roster fields (First Name, Last Name, etc.). The user, assuming this was normal, proceeded with the import.
5. **Data Loss:** The frontend sent a payload containing only roster data. The backend correctly saved the players but received no score data to write.

## Fixes Implemented

### 1. Backend Hardening (Defense in Depth)
*   **File:** `backend/services/schema_registry.py`
*   **Fix:** Updated `get_schema` to explicitly check if the input is truthy.
    ```python
    if not sport_or_id:
        return None
    ```
*   **Result:** If an event has a null template, `get_schema` returns `None`. The calling function (`get_event_schema`) detects this `None` and safely falls back to the default "football" schema instead of crashing.

### 2. Frontend Safety (Visibility & Blocking)
*   **File:** `frontend/src/components/AdminTools.jsx`
*   **Fix 1 (Warnings):** Added a `schemaError` state. If the schema fetch fails or returns 0 drills, a prominent UI warning replaces the drill mapping section: *"⚠️ Failed to load event configuration. Drill scores may not import correctly."*
*   **Fix 2 (Blocking):** The "Import" action now checks if `drillDefinitions` is empty. If so, it forces a browser confirmation dialog warning the user that **only roster data will be imported** and scores will be ignored.

## Future Prevention
*   **No Silent Failures:** The system can no longer degrade to a "roster-only" mode without explicit user confirmation.
*   **Robust Defaults:** The backend will always provide a usable schema (defaulting to Football) even if the database configuration is corrupted (null/missing template).
*   **UI Feedback:** Users are visually alerted if their event configuration is preventing drill data recognition.

## Verification
*   Scanned Firestore for other events with `drillTemplate: null` (Found 0).
*   Verified that `CreateEventModal` and `EditEventModal` enforce non-null template selection.


