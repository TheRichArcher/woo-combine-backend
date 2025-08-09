### Buyer Packet Contents

Include the following files and exports when sharing with a prospective acquirer:

- API docs: export `/docs` (OpenAPI JSON) and include `docs/API_REFERENCE.md` and `docs/API_CONTRACT.md`
- Architecture: diagram (attach), plus `docs/README.md`, `docs/SECURITY.md`, `docs/DATA_CONTRACTS.md`
- Runbooks: `docs/runbooks/` (Incident Response, Credential Outage, Firestore Quota Exceeded, Rate Limit Tuning)
- Ops: `docs/ENV_VARS_AND_RENDER_SETUP.md`, `render.yaml`, `Dockerfile`
- Metrics: screenshots/exports from Sentry, uptime provider, and frontend analytics (DAU/MAU)
- Compliance: `docs/PRIVACY_AND_TERMS_ONE_PAGER.md` and any vendor DPAs/licenses
- Acceptance: `docs/testing/ACCEPTANCE_REPORT_TEMPLATE.md` filled for staging walkthrough

Sign-off checklist: `docs/checklists/FINAL_CLEANUP_CHECKLIST.md`


### CI/QA Proof Links

- CI (unit + backend tests): [latest passing run](<link-to-ci>)
- k6 performance: [HTML report](docs/perf/k6-report.html), [JSON summary](docs/perf/k6-summary.json)
- Lighthouse: [summary](docs/qa/lighthouse-summary.md), [HTML report](<link-to-lighthouse-html>)
- Smoke test: [latest run log](docs/qa/smoke-run-latest.md)

### Known Limitations & Next 90 Days

- Limited offline support; add caching and graceful retry for rank views
- No multi-tenant org boundary yet; leagues are project-scoped
- Evaluator auth is email-based; add magic-link short-lived codes
- Aggregated ranking weights are per-session; persist per-league presets
- Export formats are CSV-first; add PDF and JSON API for external tools
- Mobile UX is good for data entry; optimize coach dashboards for small screens



