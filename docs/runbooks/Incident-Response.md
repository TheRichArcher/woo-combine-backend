### Incident Response Runbook — severity matrix, comms, status page

Owners
- Primary: On-Call (Engineer A)
- Secondary: Engineer B
- Incident Manager (as assigned)

SLAs (from `docs/ALERTING_AND_ERROR_BUDGETS.md`)
- Ack: High 5m / Medium 15m / Low 60m
- Mitigation: High 30m / Medium 2h / Low 1 business day
- RCA: within 2 business days

Severity Matrix
- SEV1 (High): Full outage or core flows unusable for >10% of users, or security/privacy risk. Page immediately.
- SEV2 (Medium): Partial degradation, elevated error rates, performance regression breaching SLOs for >10m.
- SEV3 (Low): Minor bug with workaround; no SLO breach.

Activation
1) On-Call acknowledges alert (Slack `#oncall-woo-combine`/PagerDuty).
2) Create incident channel: `#inc-YYYYMMDD-<short>`.
3) Assign roles: Incident Manager, Comms, Ops, SME.

Initial Triage
- Check `/health` and `/api/health`.
- Review Sentry dashboards (FE/BE) and Render logs.
- Identify blast radius and category: Auth, Firestore, Network, Deployment, Rate Limits.

Comms Template (external status page + customer update)
- Title: [Service] Incident — [Summary]
- Impact: What users see; affected regions/environments.
- Start time (UTC):
- Current status: Investigating | Mitigating | Monitoring | Resolved
- Next update ETA: [15–30 minutes]
- Reference: we’ll provide RCA within 2 business days.

Status Page Update
- If SEV1/SEV2, post immediately with “Investigating”. Update every 30 minutes or upon material change.
- Close with “Resolved” including duration and user impact summary.

Common Playbooks
- Credentials: follow `Credential-Outage.md`.
- Firestore quota: follow `Firestore-Quota-Exceeded.md`.
- Rate limit changes: follow `Rate-Limit-Tuning.md`.

Aftercare
- Document timeline and root cause.
- File follow-ups: prevention (tests/alerts/runbooks), config changes, monitoring gaps.
- Review in weekly ops review.

References
- SLOs and alerting: `docs/ALERTING_AND_ERROR_BUDGETS.md`
- Observability overview: `docs/README-OBSERVABILITY.md`

