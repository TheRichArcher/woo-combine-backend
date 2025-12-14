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

**Acceptance Criteria**:
1. Update `frontend/src/utils/teamFormation.js`.
2. Logic:
   - Split pool into "Scored" and "Unscored".
   - Distribute "Scored" players across teams to balance total points.
   - Distribute "Unscored" players across teams to balance count.
3. **QA Check**: Create a cohort with 5 elites and 20 zeros. Generate 2 teams. Verify elites are split 3 vs 2 (or similar), not 5 vs 0.

**Priority**: Medium (Critical for event day, but less blocking than import).
