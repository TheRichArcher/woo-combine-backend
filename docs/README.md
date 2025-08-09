### Documentation Index

Start here to get productive quickly. Each section links to focused docs.

- Getting Started: `docs/GETTING_STARTED.md`
- API Reference (OpenAPI): `docs/API_REFERENCE.md`
- Data Contracts: `docs/DATA_CONTRACTS.md`
- Runbooks: `docs/runbooks/` (see: Incident Response, Firestore Quota Exceeded, Credential Outage, Rate Limit Tuning)
- Security (headers, CSP, rate limits, auth): `docs/SECURITY.md`
- Release Process: `docs/RELEASE_FLOW.md`

Additional resources:
- Environment variables and Render setup: `docs/ENV_VARS_AND_RENDER_SETUP.md`
- Guides: `docs/guides/`
- Reports: `docs/reports/`
- Checklists: `docs/checklists/`

Buyer readiness highlights:
- Security headers, CORS, and rate limiting enforced by default
- Error monitoring ready (Sentry) in both backend and frontend via environment variables
- CI pipeline runs linting, tests, build, and dependency audit
- Backend tests cover contract endpoints, security headers, and basic role gating

