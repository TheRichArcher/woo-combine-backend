### Firestore Backup/Restore (Staging → Sandbox)

Last tested: 2025-08-09

Prereqs:
- gcloud CLI authenticated; roles: Owner/Editor on both projects
- Env:
  - `STAGING_PROJECT_ID="<staging-project>"`
  - `SANDBOX_PROJECT_ID="<temporary-sandbox-project>"`
  - `BUCKET="gs://<staging-backups-bucket>"`

Backup (Export):
```
gcloud config set project "$STAGING_PROJECT_ID"
gcloud firestore export "$BUCKET/exports/$(date -u +%Y%m%d-%H%M%S)" --async
```

Restore (Import to sandbox):
```
gcloud config set project "$SANDBOX_PROJECT_ID"
LATEST=$(gsutil ls -d "$BUCKET/exports/*" | tail -n1)
gcloud firestore import "$LATEST"
```

Notes:
- Export includes all collections and indexes; ensure Firestore in Native mode.
- Staging and sandbox must be in the same GCP region as the bucket.
- Use temporary sandbox; delete after verification.

Verification:
- Inspect key collections (`leagues`, `events`, `players`) count matches staging snapshot.
- Run `/health` on sandbox backend if connected.


