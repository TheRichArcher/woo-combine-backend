# Epic: Usability & Resilience Improvements
**Status**: Planned
**Priority**: Medium
**Created**: December 13, 2025

This epic tracks specific user-facing improvements to reduce friction in key workflows (Import, Team Formation) identified during QA analysis.

---

## 🎫 Ticket 1: Resilient Import Column Mapping
**Context**:
Users often upload CSVs with headers that *almost* match our expected fields but fail auto-detection, leading to frustration or silent data loss.
- **Example**: User uploads "Jersey #" instead of "Number", or "First" instead of "First Name".
- **Current Behavior**: The system ignores the column. The user must manually map it or realizes later the data is missing.
- **Desired Behavior**: The import engine should fuzzy-match common variations (e.g., `#`, `No.`, `Jersey` -> `number`) and auto-select them.

**Acceptance Criteria**:
1. Update `frontend/src/utils/csvHelpers.js` (or equivalent) to support a list of synonyms for standard fields.
   - `number`: `['#', 'no', 'jersey', 'num', 'jersey #', 'uniform', 'uniform #']`
   - `first_name`: `['first', 'fname', 'given name', 'first name']`
   - `last_name`: `['last', 'lname', 'surname', 'family name', 'last name']`
   - `age_group`: `['division', 'class', 'group', 'team', 'squad']`
   - `40_yard_dash`: `['40yd', '40 yard', '40', '40 dash']`
   - `vertical_jump`: `['vert', 'vertical', 'jump', 'vj']`
2. **UI Feedback**: `ImportResultsModal` should visually indicate (e.g., via a "magic wand" icon or tooltip) when a column was auto-mapped via a synonym.
3. **QA Check**: Upload a CSV with "Jersey #" and "Division" headers -> confirm they map automatically.

**Priority**: High (Reduces support burden).

---

## 🎫 Ticket 2: Robust "Balanced" Team Formation
**Context**:
The "Balanced" algorithm attempts to equalize the *average composite score* of teams. If many players have a score of `0` (no data yet) or `null`, the algorithm treats them as equal to low-performers, potentially stacking all the best players on one team if the sort order is unstable.
- **Example**: 50 players. 10 have scores (80-90), 40 have 0.
- **Current Behavior**: Algorithm might distribute the 10 scored players randomly or clump them if the `0`s skew the average calculation.
- **Desired Behavior**:
  - Filter out `0` score players from the balancing logic initially (or treat them as a separate tier).
  - Distribute the *scored* players evenly first (Snake Draft style by score).
  - Then distribute the *unscored* players evenly.

**Current Failure Modes**:
- **Zero-Score Skew**: If many players have 0 scores (or null), the average is heavily dragged down. If the algorithm naively balances averages, it might put all 5 high-scoring players on Team A (Avg 80) and 20 zero-score players on Team B (Avg 0), thinking "Team A needs more points".
- **Unbalanced Tiers**: It doesn't distinguish between "Unscored" (0 points) and "Low Skill" (10 points).

**Balanced Definition**:
- **Primary**: Roughly equal "Total Composite Score" per team.
- **Secondary**: Roughly equal number of "Scored Players" per team (to ensure competitive balance).
- **Tertiary**: Roughly equal number of "Unscored Players" per team (to ensure roster size balance).

**Edge Case Behaviors**:
- **Mixed Scored/Unscored**: Split the pool. Distribute scored players first (Snake Draft by score). Then distribute unscored players (Snake Draft by random or ID).
- **All Zeros**: Fallback to random distribution or Snake Draft by Name/Number to ensure even count.
- **Odd Numbers**: Teams may differ by at most 1 player.

**Acceptance Criteria**:
1. Update `frontend/src/utils/teamFormation.js`.
2. Logic:
   - Split pool into "Scored" (>0) and "Unscored" (0/null).
   - Distribute "Scored" players across teams using Snake Draft (High->Low).
   - Distribute "Unscored" players across teams to fill remaining slots (or just balance count).
3. **QA Check**: Create a cohort with 5 elites (Score 90+) and 20 zeros. Generate 2 teams. Verify elites are split 3 vs 2 (or similar), not 5 vs 0. Verify total roster size is 12 vs 13.
4. **Deterministic**: Verify that clicking "Generate" multiple times with the same inputs produces the same teams.
5. **Known Limitations**:
   - Balanced mode assumes composite scores reflect actual player strength.
   - If elite players are left unscored, they will be treated like any other unscored player.

**Priority**: High (Event Day Critical).
**Status**: Implemented & QA'd.
**Estimate**: 3-5 hours.
**Estimate**: 3-5 hours.

---

## 🎫 Ticket 3: Player Details "Edit" Resilience
**Context**:
When a coach edits a player's details (e.g., correcting a typo in name or jersey number) via the Player Details modal, the change sometimes doesn't reflect immediately in the parent list, requiring a manual page refresh.
- **Current Issues**:
  - `PlayerDetailsModal` updates the player via API but the parent `Players.jsx` list relies on `useEvent` or internal state that isn't triggered to re-fetch.
  - Users have to hit F5 to see the corrected name or number.
- **Expected Behavior**:
  - On "Save", the modal should trigger a context update or callback that forces the parent list to update optimistically or re-fetch.
- **Weak Point**: The data flow between `PlayerDetailsContext` (where the modal lives) and `Players.jsx` (where the list lives) is loosely coupled. `EditPlayerModal` calls `onSave` prop, which triggers `fetchPlayers` in the parent, but `PlayerDetailsContext` might be holding onto a stale `selectedPlayer` object if it's not explicitly updated.

**Acceptance Criteria**:
1. **Context Update**: `PlayerDetailsContext` must expose an `updateSelectedPlayer(partialData)` method to allow in-place updates without closing the modal.
2. **Optimistic UI**: `EditPlayerModal` should call this method on success.
3. **List Refresh**: The parent `onSave` callback must effectively trigger a re-fetch of the main list (this already exists but needs verification).
4. **Failure Model**: 
   - We will use **Option B**: Keep the local change but warn on failure.
   - If the API call fails, the optimistic update is NOT applied (because we await the API before calling `updateSelectedPlayer`).
   - If the API succeeds but the parent refresh fails/lags, the local `selectedPlayer` is still updated so the modal looks correct.
5. **QA Check**: 
   - **Edit Name**: Open player -> Edit Name -> Save. Verify name changes in list instantly.
   - **Failure**: Simulate offline/API error. Verify modal stays open, error is shown, and name does NOT change in list.
   - **Rapid Edits**: Edit Name -> Save -> Edit Number -> Save. Verify both stick without lag/reverts.
**Priority**: Medium (Polishing).
**Estimate**: 2-3 hours.
