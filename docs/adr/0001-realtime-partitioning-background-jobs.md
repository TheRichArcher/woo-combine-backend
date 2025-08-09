### ADR 0001: Real-time Updates, Partitioning for Large Events, and Background Jobs

Status: Accepted

Date: 2025-08-09

Owners: Platform/Backend

Related: `docs/DATA_CONTRACTS.md`, `backend/routes/players.py` (`/players`, `/rankings`, `/players/upload`), frontend pages `LiveStandings.jsx`, `CoachDashboard.jsx`

---

### Context

- Current frontend relies on request/response polling for rankings and players. There are no streaming endpoints yet.
- Evaluations are posted via standard HTTP; admins/coaches want near-real-time updates in Live Standings and an evaluator submissions feed.
- Events can be very large (>10k players). Full-scan aggregations per request are too costly. We need partitioned caches and background computation.
- Infrastructure today: FastAPI on Render, Firestore (GCP). No Redis deployed. WebSocket support on Render exists but introduces stateful fanout concerns and cross-instance coordination.

---

### Decision

1) Real-time transport: Server-Sent Events (SSE) now; re-evaluate WebSockets later if bidirectional needs emerge.

- We will implement SSE endpoints for:
  - Live rankings updates per event (and optionally filtered by `age_group`).
  - Evaluator submissions feed (server-to-client push of new submissions/aggregations for observers/admins).

- Initial endpoints (examples):
  - `GET /api/events/{event_id}/live/rankings?age_group=...` → `text/event-stream`
  - `GET /api/events/{event_id}/live/evaluations?age_group=...` → `text/event-stream`

- Why SSE over WebSockets now:
  - Simpler to implement/operate behind existing proxies and Render; uses standard HTTP, no special sticky sessions.
  - Matches one-way push use-cases (UI listens; writes remain HTTP POSTs).
  - Works well with backpressure via retry/Last-Event-ID; straightforward reconnect handling.

- When to switch/augment with WebSockets:
  - If we add interactive real-time features that require low-latency bidirectional messaging (e.g., collaborative scoring tools) or very high fanout requiring pub/sub fanout optimizations.

2) Partitioning for very large events: per-`age_group` partitions with separate ranking caches.

- Partitioning key: `(event_id, age_group)` for rankings and evaluator feeds.
- Caches:
  - Maintain Firestore documents for normalized drill stats and precomputed scores per partition.
  - Proposed collection shape:
    - `events/{event_id}/rankings_cache/{age_group}` containing:
      - `stats`: per-drill min/max/mean/variance, counts
      - `default_weights_scores`: optional precomputed composite scores for default weights
      - `last_computed_at`, `version`
  - Frontend can compute dynamic rankings client-side using `stats` and current weights, or backend can compute server-side for consistency when required.
- Invalidation triggers (aligned to `docs/DATA_CONTRACTS.md`):
  - New evaluation in partition
  - Player add/remove in partition
  - Age-group weight preset changes (if we cache default weights)
  - Explicit cache bust on CSV import completion

3) Background jobs: offload heavy CSV imports and aggregations to Cloud Run Jobs (or Cloud Functions 2nd gen) with Pub/Sub/Tasks.

- Queueing: On `POST /api/players/upload`, if payload size or computed work exceeds thresholds, enqueue a job with `{event_id, batch_id, partitions}` to Pub/Sub (preferred) or Cloud Tasks calling a worker endpoint.
- Worker responsibilities:
  - Validate and write players in batches (idempotent, retry-safe)
  - Recompute partition stats for each affected `age_group`
  - Optionally compute `default_weights_scores` and write to `rankings_cache`
  - Emit SSE invalidation messages (or publish notifications) once partitions are ready
- Deployment targets:
  - Primary: GCP Cloud Run Jobs (containerized, concurrency controls, max duration)
  - Alternative: Cloud Functions 2nd gen (HTTP-triggered; similar limits)
  - If staying within Render only: a background worker service + queue substitute (e.g., Render cron/worker + Google Pub/Sub or a lightweight Redis if introduced)

---

### Alternatives Considered

- WebSockets now:
  - Pros: bidirectional, efficient message framing, mature libs
  - Cons: more complex scaling/fanout; requires a broker (Redis/PubSub) to coordinate across instances; additional operational surface area today

- Polling-only:
  - Pros: simplest, already in place
  - Cons: higher latency, unnecessary load on backend/Firestore at scale, worse UX

- Firestore client-side listeners only:
  - Pros: offloads backend; FE listens directly to Firestore
  - Cons: complicates auth/rules; ties FE strongly to Firestore schema; less control over normalization/weight calculations server-side

---

### Tradeoffs

- SSE vs WebSockets
  - SSE simpler and fits our one-way push; limited to server→client; max ~1 connection per tab; similar per-connection costs
  - WebSockets provide bidirectional messaging and lower overhead per message but need coordination infra to scale cleanly

- Firestore-backed caches vs in-memory
  - Firestore caches are consistent across instances and survive restarts; slightly higher write cost
  - In-memory LRU is fast but not shared; inconsistent results with multiple instances and during deploys

- Cloud Run Jobs vs Functions
  - Jobs: better for batch/long-running processes; controlled concurrency
  - Functions: simpler triggers; stricter time limits; easier initial setup

---

### Consequences

- We introduce new SSE endpoints and internal cache recomputation flows.
- For cross-instance notifications (SSE fanout), we will initially rely on cache document `last_computed_at` polling tick inside SSE producers; later phases may add Pub/Sub for real-time invalidation.
- Background processing adds a queue and worker deployment to our ops surface.

---

### Rollout Plan

Phase 1 (now):
- Implement SSE endpoints with periodic tick (e.g., 1–2s) that stream updated rankings when `rankings_cache/{age_group}.last_computed_at` advances.
- Keep evaluator submissions feed minimal: stream new submission metadata (player, drill, evaluator, timestamp) observed via periodic queries.
- Maintain per-partition stats in Firestore; recompute synchronously on small changes to validate flow.
- FE: opt-in to SSE for Live Standings and admin observer views; keep polling as fallback.

Phase 2:
- Add background worker (Cloud Run Job or Functions) triggered by CSV upload completion and high-volume evaluation bursts.
- Move recompute of `stats` and `default_weights_scores` to worker; write to `rankings_cache` per partition.
- Introduce Pub/Sub (or Redis, if adopted) for cross-instance invalidation; SSE producers subscribe to messages to push immediately.

Phase 3:
- Evaluate WebSockets for features needing bidirectional low-latency interactions; maintain SSE as default for simple observers.
- Add fine-grained partition channels (e.g., per drill or per team) if needed for extremely large events.

---

### Success Metrics

- Real-time UX
  - P95 time-to-visibility for a new evaluation on observer UI: ≤ 2s (Phase 1), ≤ 500ms (Phase 2 with broker)
  - SSE disconnect rate < 2% per hour; automatic reconnect success > 99%

- Performance/Cost
  - P95 `/rankings` CPU time reduced by ≥ 70% under load due to cache reuse
  - Firestore read ops for live pages reduced by ≥ 50% vs polling baseline
  - Background import throughput: ≥ 1k rows/sec sustained; 50k-row CSV completes ≤ 60s (P95)

- Reliability
  - Cache correctness: zero known stale > 5s after recompute (Phase 2)
  - Job success rate ≥ 99.9% with idempotent retries; alert on failures

---

### Implementation Notes (non-binding)

- SSE in FastAPI: use `StreamingResponse` with `text/event-stream`, heartbeat every 15s, support `Last-Event-ID`.
- Ranking cache doc schema: keep compact; avoid storing full 10k arrays—store stats and, if needed, top-N (e.g., 200) with cursor for pagination.
- Dynamic weights: compute on client using `stats` (min/max per drill) when feasible; server-side endpoint remains for canonical/export cases.
- Jobs: batch Firestore writes (500 per batch), exponential backoff on contention, idempotency keys per `(event_id, batch_id)`.

---

### Open Questions

- Do we need Redis now for pub/sub and ephemeral evaluator feed backlog, or is Pub/Sub sufficient given Firestore on GCP?
- How much data should we push over SSE per tick for 10k players—should we limit to deltas or top-N only?


