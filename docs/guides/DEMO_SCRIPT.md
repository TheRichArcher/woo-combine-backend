### WooCombine 5–7 minute demo script

Goal: Show end-to-end flow: create/view demo league, events, players, live rankings, and evaluator submissions.

Prereqs (already set up on dev/staging):
- Backend running with `ENABLE_DEMO_SEED=true` and `DEMO_SEED_TOKEN` configured
- Frontend pointed at the same backend API

One-time seed (under 1 minute):
1) Run:
   - Local: `DEMO_SEED_TOKEN=$TOKEN python3 scripts/seed_demo.py --base-url http://localhost:8000`
   - Staging: `DEMO_SEED_TOKEN=$TOKEN python3 scripts/seed_demo.py --base-url https://<staging-host>`
2) Output returns `league_id` and `event_ids`.

Talk track (5–7 minutes):
1) Welcome screen → Login (use demo account). Select role Organizer or Coach if first time.
2) Select League → pick `Demo League`.
3) Events → show two events: `Spring Showcase`, `Elite Combine`.
4) Open `Spring Showcase`:
   - Players: ~50 players across `12U`, `14U`, `16U` with jersey numbers.
   - Show CSV upload UI (no need to upload; seeded already) and manual add player.
5) Live Rankings:
   - Filter by `14U`. Rankings immediately populated from aggregated evaluations.
   - Adjust weights sliders; watch rankings reorder.
6) Player details:
   - Open a player card. Show drill scores (latest snapshot fields shown).
   - Mention multi-evaluator aggregation behind the scenes (5–8 attempts per drill).
7) Evaluators:
   - Show evaluators list on event.
   - Explain that each evaluation writes to `drill_evaluations` and updates `aggregated_drill_results` and player snapshot.
8) Export:
   - Show CSV export of rankings.

Key proof points:
- Multi-evaluator submissions aggregated per drill
- Live rankings per age group and adjustable weights
- 100 players seeded; ready in under a minute

Reset/Repeat:
- Re-run the seed script anytime; it de-duplicates by league/event name and appends new player/evaluation data as needed.


