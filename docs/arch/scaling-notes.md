### Scaling Notes

Firestore limits:
- 10k writes/s per database; 500 ops per batch; hot document contention limits.
- Use `user_memberships` for O(1) league lookups; batch writes for atomic joins.

Hot paths:
- Rankings computed client-side with server-side validation; aggregated results updated on evaluator submissions.
- Use caching at CDN for read-only endpoints that are safe to cache.

Real-time path (SSE/WebSockets):
- Add a small Node/Cloud Run service with WebSocket fanout per event room.
- Publish evaluator submissions to Pub/Sub (or Redis Streams) and push to clients.

Partitioning plan:
- Partition large events by lane/station; per-station subcollections for writes.
- Use sharded counters for high-frequency metrics.



