# Release Flow

This document defines the end-to-end release process across Dev, Staging, and Production.

## Environments
- **Dev**: Auto-deploys from `main` on every push. Useful for integration testing.
- **Staging**: Deploys from a protected branch (e.g., `staging`). Requires review/approval.
- **Prod**: Deploys from tagged releases (e.g., `v1.2.3`). A changelog entry is required for each tag.

## Frontend
- Static site built to `frontend/dist` (Vite).
- HTTPS enforced via `_redirects` (301) and `index.html` runtime redirect safeguard.
- HSTS and basic security headers set via `_headers`.
- `VITE_API_BASE` must be set per environment (see `docs/ENV_VARS_AND_RENDER_SETUP.md`).

## Backend
- FastAPI service in Docker, non-root user, health endpoint at `/health` and extended `/api/health`.
- Render health check path: `/health`.
- Stateless API; sticky sessions not required.

## Deployment Strategy (Prod)
- Use Render zero-downtime (rolling) deploys gated by health checks.
- Target impact: ≤ 1 minute, typically sub-10s due to rolling handover.
- Blue/Green alternative: Run a parallel service for pre-cutover validation if needed. Switch traffic via DNS or Render promote.

## Health & Warmup
- Health checks must be green post-deploy (`/health` returns 200).
- Frontend triggers backend warmup automatically after user authentication by calling `/api/warmup` and `/api/health` in parallel.

## Autoscaling Guidance
- Recommended starting limits: min 1, max 4 instances; target CPU ~60%, Memory ~70%.
- Tune based on P95 latency and error budgets.

## Release Steps
1) Merge to `main` to auto-deploy Dev.
2) Cherry-pick or merge into `staging` (protected) for Staging deploy and QA sign-off.
3) Create a tag `vX.Y.Z` on the approved commit and push tag to trigger Prod deploy.
4) Update `CHANGELOG.md` with highlights, fixes, and any migration notes.
5) Monitor health dashboards; verify warmup and login flows.

## Compliance Checklist
- [ ] Changelog updated
- [ ] Health check green
- [ ] Login triggers warmup without errors
- [ ] No sticky sessions required; stateless verified
- [ ] HTTPS enforced

