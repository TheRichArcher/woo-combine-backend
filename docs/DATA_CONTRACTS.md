### WooCombine Data Contracts

This document defines the canonical data contracts enforced across the system (backend validation and frontend import UX).

### 1) Player CSV Import

- **Required columns**: `first_name`, `last_name`, `jersey_number`
- **Optional columns**: `external_id`, `team_name`, `position`, `notes`

Import rules:
- **Age group** (optional). When provided, allowed values (case-insensitive on import, stored canonicalized):
  - Range forms: `5-6`, `7-8`, `9-10`, `11-12`, `13-14`, `15-16`, `17-18`
  - U-forms: `6U`, `8U`, `10U`, `12U`, `14U`, `16U`, `18U`
- **Jersey number**: integer 1–9999
- **Name**: will be stored as both `first`, `last`, and `name = "first last"`
- **Optional fields** are stored if present: `external_id`, `team_name`, `position`, `notes`
- Frontend will auto-assign `jersey_number` if missing to satisfy the required column.

Duplicate detection (per event):
- Duplicate if same `external_id`
- Duplicate if same `(first_name, last_name, jersey_number)`
- Duplicate if same `(first_name, last_name, age_group)` when jersey numbers are missing/conflicting

Response on upload returns `{"added": N, "errors": [{row, message}]}`; the frontend must show row-level errors.

### 2) Evaluation Records (Granular)

Each evaluator submission creates an immutable evaluation record with:
- `event_id`, `player_id`, `drill_id` (aka `drill_type`), `evaluator_id`
- `value` (validated per drill constraints), `unit`
- `recorded_at` (ISO 8601), and `notes`

Value constraints and units (per football combine drills):
- `40m_dash`: seconds, `value >= 0` and reasonable bounds [3.0, 30.0]
- `vertical_jump`: inches, `value >= 0` within [0, 60]
- `catching`: points, `0–100`
- `throwing`: points, `0–100`
- `agility`: points, `0–100`

These are enforced server-side on submission.

### 3) Aggregated Results

For each `(player_id, drill_id)` combination we maintain an aggregated document containing:
- `mean` (average), `median`, `variance`, `attempts_count`, `final_score`
- `evaluations` (list: evaluator_id, evaluator_name, value, notes, created_at)
- `last_updated` (ISO 8601)

Attempts are recomputed whenever a new granular evaluation is written.

### 4) Scoring & Rankings

Normalization:
- Per-event and filtered to the selected `age_group` when ranking by age group
- Min–max scaling to 0–100 per drill; fallback to 50 when `max == min`
- Fallback sample rule: if fewer than N=3 valid samples exist for a drill in the selected age group, fall back to using all event samples for that drill; if still < 3, score remains 50

Lower-is-better drills:
- These are inverted during normalization (e.g., `40m_dash`): normalized = `(max - value) / (max - min) * 100`

Weights:
- Per-drill weight range: `0–100` each; default presets for football:
  - `40m_dash`: 30
  - `vertical_jump`: 20
  - `catching`: 15
  - `throwing`: 15
  - `agility`: 20
- Weights must sum to `100`. Frontend may accept partial edits but must normalize to sum=100 before requesting backend rankings (when used).

Ranking cache invalidation triggers:
- New evaluation for any included drill
- Drill weight change
- Player added/removed within the event
- Age-group filter change

### 5) Storage Shape (Firestore)

- `events/{event_id}/players/{player_id}`
  - `id`, `name`, `first`, `last`, `number`, `age_group`, optional: `external_id`, `team_name`, `position`, `notes`
  - Drill snapshots (latest): `40m_dash`, `vertical_jump`, `catching`, `throwing`, `agility`
- `events/{event_id}/drill_evaluations/{auto_id}` (granular)
  - `event_id`, `player_id`, `type` (drill_id), `value`, `unit`, `evaluator_id`, `evaluator_name`, `notes`, `created_at` (also `recorded_at`)
- `events/{event_id}/aggregated_drill_results/{player_id}_{drill_id}`
  - `player_id`, `drill_type`, `evaluations`, `average_score` (mean), `median_score`, `score_variance`, `attempts_count`, `final_score`, `last_updated`

Notes:
- Backend endpoints validate all constraints above; FE surfaces row-level errors for CSV import.


