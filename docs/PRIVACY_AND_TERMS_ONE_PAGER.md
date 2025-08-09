## WooCombine Privacy, Terms, and Data Handling Overview

This one-pager summarizes what we collect, how we use it, retention, deletion, and youth privacy posture.

### Data We Collect
- Account data: email, role (coach, organizer, evaluator)
- Event data: event name, dates, location, participants
- Player performance data: drill results, rankings, weights configured by organizers
- Audit/log data: app errors, minimal analytics for reliability and support

We do not sell personal data. Data is used solely to operate WooCombine features.

### Legal Contact and Support
- Terms: available in-app at /terms
- Privacy: available in-app at /privacy
- Support: support@woo-combine.com
- Privacy inquiries: privacy@woo-combine.com
- Legal inquiries: legal@woo-combine.com

### Youth Privacy (COPPA/GDPR-K) Posture
- Intended use: WooCombine is used by coaches/organizers for youth sports events.
- Youth PII policy: Organizers should avoid collecting direct identifiers for minors in the app; use initials or jersey numbers where possible.
- Parental consent: If an organization chooses to store youth PII, organizer is responsible for obtaining verifiable parental consent per their policy and local law. WooCombine can document the organizer’s attestation on request.
- Data subject rights: Requests (access, correction, deletion) can be submitted via support email; we will coordinate with the organizer as controller.

### Data Retention
- Retention is set per event by the organizer’s policy. Default recommendation: retain event data for up to 24 months after event end unless organizer requires longer for league history.
- Backups and logs may persist for up to 30 days.

### Delete on Request (Runbook)
Initial manual process; automation to follow.
1) Receive request at support@woo-combine.com or privacy@woo-combine.com.
2) Verify requester identity and relationship to event (coach/organizer or parent via organizer).
3) Locate records by eventId/playerId/user email.
4) Delete records in Firestore collections (users, events, players, results) and any cached aggregates.
5) Remove from analytics/log retention where feasible; note backups expire automatically.
6) Confirm deletion to requester and organizer; document in ticket.

### Security
- Data encrypted in transit (HTTPS) and at rest (cloud provider managed).
- Principle of least privilege across services; access via Firebase/Auth.
- Rate limiting, abuse protection, and audit logging enabled.

### Notes
- The organizer acts as controller for event data. WooCombine operates as processor/service provider.
- For jurisdiction-specific obligations (e.g., GDPR), we honor data subject requests relayed by the organizer.


