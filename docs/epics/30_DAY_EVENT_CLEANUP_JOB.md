# Epic: 30-Day Event Hard-Delete Cleanup Job

**Status:** 📋 PLANNED (Follow-up to Event Deletion Feature)  
**Priority:** P2 - Important but not blocking  
**Estimated Effort:** 3-5 days  
**Dependencies:** Event Soft-Delete Feature (Completed)

---

## Overview

Implement an automated cleanup job that permanently deletes (hard-deletes) events that have been soft-deleted for more than 30 days. This completes the event deletion lifecycle and ensures database hygiene while maintaining the 30-day recovery window.

## Background

The event deletion feature implements soft-delete with a 30-day recovery window:
- Events are marked with `deleted_at` timestamp
- Events are hidden from UI immediately
- Data is retained for 30 days for recovery
- **Missing:** Automated cleanup after 30 days

Without this cleanup job, soft-deleted events accumulate indefinitely, consuming database storage and potentially causing performance issues.

## Goals

1. **Automated Cleanup:** Permanently delete events after 30-day retention period
2. **Safety Net:** Send warning email 7 days before hard-delete
3. **Audit Trail:** Log all hard-delete operations
4. **Manual Override:** Allow support to extend retention for specific events
5. **Data Integrity:** Properly clean up all subcollections and related data

## Non-Goals

- Immediate hard-delete (30-day window is intentional)
- User-initiated hard-delete (only automated)
- Bulk delete UI (only automated job)

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cloud Scheduler (Google Cloud)                              │
│  - Runs daily at 2:00 AM UTC                                 │
│  - Triggers Cloud Function                                   │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────┐
│  Cloud Function: cleanupDeletedEvents                        │
│  - Queries events with deleted_at > 30 days old              │
│  - Sends warning emails (7 days before)                      │
│  - Hard-deletes events (30+ days old)                        │
│  - Logs all operations                                       │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────┐
│  Firestore Database                                          │
│  - Query: deleted_at < (now - 30 days)                       │
│  - Delete event document                                     │
│  - Delete all subcollections (players, drills, etc.)         │
└─────────────────────────────────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────┐
│  Email Service (SendGrid / Firebase Extensions)              │
│  - Send warning emails to organizers                         │
│  - Include event details and recovery instructions           │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

**Extended Event Schema:**
```javascript
{
  // Existing soft-delete fields
  "deleted_at": "2026-01-05T10:30:00Z",
  "deleted_by": "user_uid_123",
  "status": "deleted",
  
  // New fields for cleanup job
  "deletion_warning_sent": "2026-01-28T10:30:00Z",  // Optional: when warning email sent
  "hard_delete_scheduled": "2026-02-04T10:30:00Z",  // Optional: when hard-delete will occur
  "retention_extended": false,                       // Optional: manual override by support
  "retention_extended_until": "2026-03-05T10:30:00Z" // Optional: new hard-delete date
}
```

### Cloud Function Implementation

**File:** `functions/cleanupDeletedEvents.js`

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { sendEmail } = require('./emailService');

exports.cleanupDeletedEvents = functions.pubsub
  .schedule('0 2 * * *') // Daily at 2:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const warningThreshold = new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000); // 23 days ago
    const deleteThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);  // 30 days ago
    
    console.log('[CLEANUP] Starting deleted events cleanup job');
    
    try {
      // Step 1: Find events needing warning emails (23 days old, no warning sent)
      const warningQuery = db.collectionGroup('events')
        .where('status', '==', 'deleted')
        .where('deleted_at', '<=', warningThreshold.toISOString())
        .where('deleted_at', '>', deleteThreshold.toISOString())
        .where('deletion_warning_sent', '==', null);
      
      const warningDocs = await warningQuery.get();
      console.log(`[CLEANUP] Found ${warningDocs.size} events needing warning emails`);
      
      for (const doc of warningDocs.docs) {
        await sendWarningEmail(doc);
        await doc.ref.update({
          deletion_warning_sent: now.toISOString(),
          hard_delete_scheduled: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
      
      // Step 2: Find events ready for hard-delete (30+ days old, not extended)
      const deleteQuery = db.collectionGroup('events')
        .where('status', '==', 'deleted')
        .where('deleted_at', '<=', deleteThreshold.toISOString())
        .where('retention_extended', '==', false);
      
      const deleteDocs = await deleteQuery.get();
      console.log(`[CLEANUP] Found ${deleteDocs.size} events ready for hard-delete`);
      
      for (const doc of deleteDocs.docs) {
        await hardDeleteEvent(doc);
      }
      
      console.log('[CLEANUP] Cleanup job completed successfully');
      return null;
      
    } catch (error) {
      console.error('[CLEANUP] Error during cleanup job:', error);
      throw error;
    }
  });

async function sendWarningEmail(eventDoc) {
  const eventData = eventDoc.data();
  const leagueId = eventData.league_id;
  
  // Get organizer email from league
  const leagueDoc = await admin.firestore()
    .collection('leagues')
    .doc(leagueId)
    .get();
  
  const organizerEmail = leagueDoc.data()?.organizer_email;
  
  if (!organizerEmail) {
    console.warn(`[CLEANUP] No organizer email for event ${eventDoc.id}`);
    return;
  }
  
  const emailData = {
    to: organizerEmail,
    subject: `[Action Required] Event "${eventData.name}" will be permanently deleted in 7 days`,
    html: `
      <h2>Event Deletion Warning</h2>
      <p>This is a reminder that the following event will be permanently deleted in 7 days:</p>
      <ul>
        <li><strong>Event Name:</strong> ${eventData.name}</li>
        <li><strong>Deleted On:</strong> ${new Date(eventData.deleted_at).toLocaleDateString()}</li>
        <li><strong>Hard Delete Date:</strong> ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
      </ul>
      <p><strong>If you deleted this event by mistake, contact support immediately to recover it.</strong></p>
      <p>After the hard delete date, this event and all associated data will be permanently removed and cannot be recovered.</p>
      <p>Support Email: support@woo-combine.com</p>
    `
  };
  
  await sendEmail(emailData);
  console.log(`[CLEANUP] Warning email sent for event ${eventDoc.id} to ${organizerEmail}`);
}

async function hardDeleteEvent(eventDoc) {
  const eventId = eventDoc.id;
  const eventData = eventDoc.data();
  
  console.log(`[CLEANUP] Hard-deleting event ${eventId} (${eventData.name})`);
  
  try {
    // Delete all subcollections
    await deleteSubcollection(eventDoc.ref, 'players');
    await deleteSubcollection(eventDoc.ref, 'evaluators');
    await deleteSubcollection(eventDoc.ref, 'drill_evaluations');
    await deleteSubcollection(eventDoc.ref, 'aggregated_drill_results');
    await deleteSubcollection(eventDoc.ref, 'custom_drills');
    
    // Delete event document
    await eventDoc.ref.delete();
    
    // Also delete from top-level events collection
    await admin.firestore()
      .collection('events')
      .doc(eventId)
      .delete();
    
    console.log(`[CLEANUP] Successfully hard-deleted event ${eventId}`);
    
    // Log to audit trail
    await admin.firestore()
      .collection('audit_logs')
      .add({
        action: 'EVENT_HARD_DELETED',
        event_id: eventId,
        event_name: eventData.name,
        league_id: eventData.league_id,
        deleted_at: eventData.deleted_at,
        deleted_by: eventData.deleted_by,
        hard_deleted_at: new Date().toISOString(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    
  } catch (error) {
    console.error(`[CLEANUP] Error hard-deleting event ${eventId}:`, error);
    throw error;
  }
}

async function deleteSubcollection(docRef, subcollectionName) {
  const snapshot = await docRef.collection(subcollectionName).get();
  
  if (snapshot.empty) return;
  
  const batch = admin.firestore().batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`[CLEANUP] Deleted ${snapshot.size} documents from ${subcollectionName}`);
}
```

---

## Implementation Tasks

### Phase 1: Cloud Function Setup (2 days)

- [ ] **Task 1.1:** Create Firebase Functions project structure
  - Initialize functions directory
  - Configure package.json with dependencies
  - Set up Firebase admin SDK

- [ ] **Task 1.2:** Implement cleanup function
  - Query logic for events needing warnings
  - Query logic for events ready for hard-delete
  - Hard-delete logic with subcollection cleanup
  - Error handling and logging

- [ ] **Task 1.3:** Implement email service
  - Set up SendGrid or Firebase Email Extension
  - Create warning email template
  - Test email delivery

- [ ] **Task 1.4:** Deploy and test function
  - Deploy to Firebase
  - Test with staging data
  - Verify Firestore queries work correctly

### Phase 2: Cloud Scheduler Setup (1 day)

- [ ] **Task 2.1:** Configure Cloud Scheduler
  - Create daily job (2:00 AM UTC)
  - Link to Cloud Function
  - Set up retry policy

- [ ] **Task 2.2:** Set up monitoring
  - Cloud Function logs
  - Error alerting
  - Success/failure metrics

### Phase 3: Manual Override UI (1-2 days)

- [ ] **Task 3.1:** Create admin endpoint
  - `POST /admin/events/{event_id}/extend-retention`
  - Requires admin role
  - Updates `retention_extended` and `retention_extended_until`

- [ ] **Task 3.2:** Create support dashboard (optional)
  - List soft-deleted events
  - Show days until hard-delete
  - One-click extend retention
  - One-click restore event

### Phase 4: Testing & Documentation (1 day)

- [ ] **Task 4.1:** Integration testing
  - Test warning email trigger
  - Test hard-delete after 30 days
  - Test retention extension
  - Test error scenarios

- [ ] **Task 4.2:** Documentation
  - Update support docs with recovery process
  - Document manual override process
  - Create runbook for cleanup job failures

---

## Testing Strategy

### Unit Tests
- Query logic for finding events
- Email template rendering
- Hard-delete subcollection cleanup
- Date threshold calculations

### Integration Tests
- End-to-end cleanup flow
- Email delivery
- Firestore operations
- Error handling

### Staging Tests
1. Create test event
2. Soft-delete it
3. Manually set `deleted_at` to 23 days ago
4. Trigger function manually
5. Verify warning email sent
6. Manually set `deleted_at` to 31 days ago
7. Trigger function manually
8. Verify event hard-deleted

---

## Monitoring & Alerts

### Metrics to Track
- Number of events warned per day
- Number of events hard-deleted per day
- Function execution time
- Function error rate
- Email delivery success rate

### Alerts
- Function fails 3 times in a row → Page on-call
- Email delivery fails → Slack notification
- Unexpected high deletion count (>10/day) → Slack notification

---

## Rollout Plan

### Week 1: Development & Testing
- Implement Cloud Function
- Test in local environment
- Deploy to staging

### Week 2: Staging Validation
- Run daily for 1 week on staging
- Verify no false positives
- Test manual override

### Week 3: Production Deployment
- Deploy to production
- Monitor closely for first week
- Adjust thresholds if needed

---

## Success Criteria

- [ ] Cloud Function runs daily without errors
- [ ] Warning emails sent 7 days before hard-delete
- [ ] Events hard-deleted after 30 days
- [ ] No accidental deletions of active events
- [ ] Support can extend retention when needed
- [ ] Audit logs capture all hard-deletes

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental deletion of active events | HIGH | Query filters for `status: "deleted"`, staging testing |
| Email delivery failures | MEDIUM | Retry logic, monitoring alerts |
| Function timeout on large batches | MEDIUM | Process in batches, increase timeout |
| False positives (wrong threshold) | LOW | 30-day window is conservative, warning email provides safety net |

---

## Cost Estimate

- **Cloud Functions:** ~$5/month (1 invocation/day, <1 min execution)
- **Cloud Scheduler:** ~$0.10/month (1 job)
- **SendGrid/Email:** ~$5/month (estimated 10-20 emails/month)
- **Total:** ~$10/month

---

## Future Enhancements

1. **Self-Service Recovery UI**
   - Allow organizers to restore their own events within 30 days
   - No support ticket needed

2. **Configurable Retention Period**
   - Allow admins to set retention per league (e.g., 60 days for premium)

3. **Bulk Operations**
   - Support team can bulk extend retention
   - Bulk restore for accidental mass deletions

4. **Analytics Dashboard**
   - Track deletion patterns
   - Identify users frequently deleting events (may indicate UX issues)

---

## Dependencies

- Firebase Functions
- Cloud Scheduler
- SendGrid or Firebase Email Extension
- Firestore indexes (for queries)

---

## Acceptance Criteria

- [ ] Function deployed and scheduled
- [ ] Warning emails sent 7 days before hard-delete
- [ ] Events hard-deleted after 30 days
- [ ] Manual override works for support team
- [ ] Audit logs capture all operations
- [ ] Monitoring and alerts configured
- [ ] Documentation updated

---

**Epic Owner:** Backend Team  
**Stakeholders:** Product, Support, DevOps  
**Target Completion:** Q1 2026  
**Status:** Ready for Sprint Planning

---

## Related Documents

- [Event Deletion Implementation](../reports/BULLETPROOF_EVENT_DELETION_IMPLEMENTATION.md)
- [Staging Validation](../qa/STAGING_VALIDATION_EVENT_DELETION.md)
- [Event Deletion Flow Diagram](../reports/EVENT_DELETION_FLOW_DIAGRAM.md)

