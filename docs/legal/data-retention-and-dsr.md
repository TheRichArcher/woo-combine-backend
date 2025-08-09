### Data Retention & Deletion (DSR)

Scope: user accounts, leagues, events, players, evaluators, drill results.

Retention defaults:
- Accounts, leagues, events: retained until deletion request; inactive projects purged after 24 months of inactivity (configurable).
- Player drill data: retained 24 months after event end, then archived or deleted.
- Logs/metrics: 30–90 days depending on provider tier (Sentry/logs).

Delete request process (DSR):
1. Verify requester identity (email verification + token).
2. Locate data by UID/email, league_id, event_id.
3. Execute deletion:
   - Delete `users/{uid}` and derived memberships.
   - For league deletion: remove `leagues/{id}` and `user_memberships` entries.
   - For event deletion: use backend delete endpoint (cascades players/evaluators/results) or admin script.
4. Confirm deletion to requester with timestamp and scope.

Export: provide JSON exports per league/event upon verified request.

SLA: respond within 7 days; complete within 30 days.



