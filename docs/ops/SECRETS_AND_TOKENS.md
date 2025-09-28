### Staging Secrets and Token Rotation

Required GitHub repository secrets and variables for staging QA/perf:

- Secrets:
  - `STAGING_BEARER_TOKEN`: Ephemeral bearer token for a verified Organizer test account with access to Demo League.
  - `DEMO_SEED_TOKEN`: Ephemeral token used by `/api/demo/seed` endpoint.
  - `LHCI_TOKEN` (optional): Token for Lighthouse CI server, if using a private LHCI server.

- Variables:
  - `STAGING_BASE_URL`: Full `https://` URL of the staging API root (e.g., `https://woo-combine-backend-staging.onrender.com`).
  - `STAGING_FRONTEND_URL`: Full `https://` URL of the staging frontend root.
  - `STAGING_BEARER_TOKEN_KEY`: Literal value `STAGING_BEARER_TOKEN` (indirection used by workflows).
  - `DEMO_SEED_TOKEN_KEY`: Literal value `DEMO_SEED_TOKEN`.
  - `LHCI_TOKEN_KEY` (optional): Literal value `LHCI_TOKEN`.
  - `LHCI_SERVER_BASE_URL` (optional): If persisting LH reports to a server.

TTL and Rotation:
- Set both tokens (`STAGING_BEARER_TOKEN`, `DEMO_SEED_TOKEN`) to expire in 48–72 hours.
- Rotation location:
  - GitHub → Repo → Settings → Secrets and variables → Actions.
  - Staging Backend service env (Render) for server-side checks:
    - `ENABLE_DEMO_SEED=true` (temporarily while seeding)
    - `DEMO_SEED_TOKEN=<matching secret>`
    - `ALLOWED_ORIGINS` should include the staging frontend origin.
    - Optional `ALLOWED_ORIGIN_REGEX` for domain patterns.

Notes:
- The demo seeding endpoint is only mounted if `ENABLE_DEMO_SEED=true` is set on the server side. Remove or set to `false` after seeding.
- Seeding is idempotent by league name and can be safely re-run while the token is valid.
- If GitHub Actions runners must be allowlisted at your WAF/firewall, include GitHub Actions IP ranges for the region executing the workflows.


## CI/CD Secrets for Smoke & Lighthouse Workflows

To enable full CI checks, the following repo-level variables and secrets must be configured:

- **STAGING_BASE_URL**: Your staging backend root URL (e.g. `https://woo-combine-api-staging.onrender.com`)
- **STAGING_BEARER_TOKEN_KEY**: Set to `STAGING_BEARER_TOKEN`
- **STAGING_BEARER_TOKEN**: A secret containing a valid Firebase bearer token for a staging user

These are used by the `Staging Smoke` (`.github/workflows/smoke.yml`) and `Lighthouse` (`.github/workflows/lighthouse.yml`) workflows to validate deploy quality on push to `main` and daily. Staging will be auto-warmed before smoke checks are run.

Make sure `/api/health` and `/api/warmup` respond correctly on your staging deployment before enabling these.


