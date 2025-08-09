### Firestore Composite Indexes

These indexes must exist in production and staging. Keep this doc in sync with `firestore.indexes.json`.

- **players**: `(event_id ASC, age_group ASC, last_name ASC)`
- **aggregated_drill_results**: `(event_id ASC, drill_id ASC, score DESC)`
- **drill_evaluations**: `(event_id ASC, player_id ASC, drill_id ASC, created_at DESC)`
- **events**: `(league_id ASC, date DESC)`
- **leagues/{leagueId}/events subcollection**: `(date DESC)`

Deployment options:

1) Firebase CLI (if using Firebase hosting/project):

```bash
firebase deploy --only firestore:indexes
```

2) Google Cloud CLI (Composite only):

```bash
gcloud firestore indexes composite create --file=firestore.indexes.json

Notes:
- The subcollection `leagues/{leagueId}/events` ordered by `date DESC` relies on a single-field index, which Firestore maintains automatically. No composite is required for that sort.
- If your `drill_evaluations` use `type` instead of `drill_id`, adjust the index or migrate the field for consistency.
```

Validation target: bulk exports of dev-sized data show p95 query latency < 200ms.


