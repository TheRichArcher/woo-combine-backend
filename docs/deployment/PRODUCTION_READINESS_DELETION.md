# Production Readiness: Event Deletion System

**Date**: January 5, 2026  
**Feature**: Bulletproof Event Deletion with Token-Based Validation  
**Status**: Deployment-topology dependent

---

## Pre-Deployment Checklist

### 1. ✅ Verify Deployment Topology

**CRITICAL**: Token replay protection depends on deployment architecture.

#### Check Your Deployment

| Environment | Type | Replay Protection Status |
|------------|------|-------------------------|
| **Render Free Tier** | Single instance | ✅ Works (in-memory OK) |
| **Render Starter** | Single instance | ✅ Works (in-memory OK) |
| **Render Standard (no autoscale)** | Single instance | ✅ Works (in-memory OK) |
| **Render Standard (autoscaled)** | Multi-instance | ❌ Requires Redis |
| **Kubernetes (replicas=1)** | Single instance | ✅ Works (in-memory OK) |
| **Kubernetes (replicas>1)** | Multi-instance | ❌ Requires Redis |
| **AWS ECS/Fargate (1 task)** | Single instance | ✅ Works (in-memory OK) |
| **AWS ECS/Fargate (>1 task)** | Multi-instance | ❌ Requires Redis |

**How to Verify**:
```bash
# Check if multiple instances are running
# Render: Check "Instances" tab in dashboard
# Kubernetes: kubectl get pods | grep backend
# AWS ECS: Check task count in service

# Test with load balancer
curl https://api.woo-combine.com/health
curl https://api.woo-combine.com/health
# If responses show different instance IDs → multi-instance
```

**Decision Tree**:
```
Is deployment single instance?
├─ YES → ✅ Current implementation is safe
│         Continue to Step 2
│
└─ NO → ❌ Redis migration required before token system
          See: docs/reports/MULTI_INSTANCE_TOKEN_STORE.md
          STOP: Do not enable token-based deletion yet
```

---

### 2. ✅ Configure Environment Variables

#### Required for All Deployments

```bash
# Backend .env
DELETE_TOKEN_SECRET_KEY=<generate_strong_32_char_secret>
```

**Generate Secret Key**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Example output:
# kN8zP2mQ9vR4sW5xT6yU7nA3bC1dE2fG3hI4jK5lM6nO7pQ8rS9t
```

**Set in Render**:
1. Go to Dashboard → Your Service → Environment
2. Add: `DELETE_TOKEN_SECRET_KEY = <your_secret>`
3. Click "Save Changes"
4. Trigger redeploy

**Set in Kubernetes**:
```bash
kubectl create secret generic backend-secrets \
  --from-literal=DELETE_TOKEN_SECRET_KEY='<your_secret>'
```

**Verify**:
```bash
# Check startup logs after deployment
# Should see:
[STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured - Token-based deletion enabled
```

#### Required for Multi-Instance (If Applicable)

```bash
# Backend .env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<redis_password>
```

---

### 3. ✅ Test in Staging First

**NEVER enable token-based deletion in production without staging verification.**

#### Staging Test Plan

**Test 1: Token Generation**
```bash
curl -X POST https://staging-api.woo-combine.com/api/leagues/{league_id}/events/{event_id}/delete-intent-token \
  -H "Authorization: Bearer {firebase_token}"

# Expected: 200 OK
# {
#   "token": "eyJhbGc...",
#   "expires_in_minutes": 5,
#   "target_event_id": "event_abc"
# }

# If 503: SECRET_KEY not configured
```

**Test 2: Token Validation**
```bash
TOKEN="<token_from_test_1>"

curl -X DELETE https://staging-api.woo-combine.com/api/leagues/{league_id}/events/{event_id} \
  -H "Authorization: Bearer {firebase_token}" \
  -H "X-Delete-Target-Event-Id: {event_id}" \
  -H "X-Delete-Intent-Token: $TOKEN"

# Expected: 200 OK (event deleted)
```

**Test 3: Replay Protection (CRITICAL)**
```bash
# Reuse same token from Test 2
curl -X DELETE https://staging-api.woo-combine.com/api/leagues/{league_id}/events/{event_id_2} \
  -H "Authorization: Bearer {firebase_token}" \
  -H "X-Delete-Target-Event-Id: {event_id_2}" \
  -H "X-Delete-Intent-Token: $TOKEN"

# Expected (Single Instance): 400 "Token already used"
# Expected (Multi-Instance without Redis): May succeed ❌
# Expected (Multi-Instance with Redis): 400 "Token already used"
```

**Test 4: Missing Header Enforcement**
```bash
curl -X DELETE https://staging-api.woo-combine.com/api/leagues/{league_id}/events/{event_id} \
  -H "Authorization: Bearer {firebase_token}"
# Note: No X-Delete-Target-Event-Id header

# Expected: 400 "Missing deletion target validation header"
```

**Test 5: Header Mismatch Enforcement**
```bash
curl -X DELETE https://staging-api.woo-combine.com/api/leagues/{league_id}/events/{event_A_id} \
  -H "Authorization: Bearer {firebase_token}" \
  -H "X-Delete-Target-Event-Id: {event_B_id}"  # Wrong ID

# Expected: 400 "Deletion target mismatch"
```

---

### 4. ✅ Verify Monitoring & Logging

#### Startup Logs

**Single Instance (Current)**:
```
[STARTUP] WooCombine API starting up...
[STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured - Token-based deletion enabled
[STARTUP] Token replay protection: ⚠ Single-instance only (in-memory)
```

**Multi-Instance (After Redis)**:
```
[STARTUP] WooCombine API starting up...
[STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured - Token-based deletion enabled
[STARTUP] Redis connection: ✓ available - Multi-instance replay protection enabled
[STARTUP] Token replay protection: ✓ Multi-instance safe (Redis)
```

#### Audit Logs

**Expected on successful delete**:
```
[AUDIT] Delete intent token issued - Event: abc, League: 123, User: user_xyz
[AUDIT] Event deletion initiated - Event: abc, Declared Target: abc, Target Match: True, Token Validated: True
[DELETE_TOKEN] Token marked as used (jti: 550e8400-...) - Replay now blocked
[AUDIT] Event deletion completed - Event: abc, User: user_xyz
```

**Expected on replay attempt**:
```
[DELETE_TOKEN] REPLAY ATTACK DETECTED - jti: 550e8400-... already used at 2026-01-05T12:01:30Z
[AUDIT] Invalid delete intent token - Event: abc, User: user_xyz, Error: Token already used
```

#### Sentry Integration

**Verify Sentry captures**:
- Missing header → Error logged
- Header mismatch → Error logged
- Token replay → Error logged

---

### 5. ✅ Document Known Limitations

**For Stakeholders (Single Instance)**:
```
Token-based deletion is active with the following characteristics:

✅ Replay protection: Works (single backend instance)
✅ Required header: Enforced (cannot bypass)
✅ Target validation: Enforced (wrong event blocked)
⚠️ Scaling limitation: Multi-instance requires Redis migration

Current deployment: Single instance (Render free tier)
Replay attacks: Blocked on this instance
```

**For Stakeholders (Multi-Instance without Redis)** ❌:
```
WARNING: Token-based deletion is NOT production-ready for this deployment.

Deployment: Multi-instance / autoscaled
Issue: Replay protection not guaranteed across instances
Risk: Attacker could replay token if different instance handles request

REQUIRED: Redis migration before enabling in production
See: docs/reports/MULTI_INSTANCE_TOKEN_STORE.md
```

---

## Production Deployment

### Go/No-Go Decision

#### ✅ GO Criteria (Single Instance)
- [x] Deployment topology verified: Single instance
- [x] `DELETE_TOKEN_SECRET_KEY` configured in production
- [x] Staging tests passed (all 5 tests)
- [x] Startup logs show token system enabled
- [x] Replay protection tested and working
- [x] Audit logging verified
- [x] Sentry integration confirmed
- [x] Stakeholders informed of single-instance limitation

#### ❌ NO-GO (Multi-Instance without Redis)
- [ ] Deployment is multi-instance/autoscaled
- [ ] Redis not configured
- [ ] Replay protection fails across instances

**Action**: Implement Redis migration first

---

## Post-Deployment Verification

### Hour 1: Immediate Checks

**Check 1: Startup Logs**
```bash
# View logs
render logs --tail 100  # Render
kubectl logs deployment/backend --tail=100  # Kubernetes

# Verify:
✓ DELETE_TOKEN_SECRET_KEY: ✓ configured
✓ Token-based deletion enabled
```

**Check 2: Token Generation**
```bash
# Test from production
curl -X POST https://api.woo-combine.com/api/leagues/{league_id}/events/{event_id}/delete-intent-token \
  -H "Authorization: Bearer {token}"

# Expected: 200 OK with token
```

**Check 3: Monitor Sentry**
- No new errors related to token validation
- No 503 errors on token endpoint

### Day 1: Usage Monitoring

**Metrics to Track**:
- Token generation count
- Token validation success rate
- Replay attempt count (should be 0 or rare)
- 400 errors (header missing/mismatch)

**Alerts to Set**:
- Token endpoint returning 503 (SECRET_KEY issue)
- High volume of replay attempts (potential attack)
- Redis connection failures (if multi-instance)

---

## Rollback Plan

### If Issues Detected

**Scenario 1: Token system not working**
```bash
# Temporarily disable token requirement in code
# Deploy emergency patch that makes token optional
# OR: Revert to previous commit
```

**Scenario 2: Replay attacks succeeding (multi-instance)**
```bash
# This confirms multi-instance deployment
# Disable token system immediately
# Schedule Redis migration
```

---

## Upgrade Path: Multi-Instance

**When ready to scale**:

1. **Deploy Redis**
   - Render: Add Redis add-on
   - AWS: ElastiCache for Redis
   - Kubernetes: Redis Helm chart

2. **Implement Redis Store**
   - Follow: `docs/reports/MULTI_INSTANCE_TOKEN_STORE.md`
   - Test in staging first
   - Verify replay protection across instances

3. **Update Documentation**
   - Change "Single instance only" → "Multi-instance safe"
   - Update stakeholder communication

---

## Summary

### Current State (Commit 89b9332)

| Feature | Status | Notes |
|---------|--------|-------|
| Server validation | ✅ Production-ready | Header required, enforced |
| Token generation | ✅ Production-ready | SECRET_KEY required |
| Token validation | ✅ Production-ready | Claims + expiry checked |
| Replay protection | ✅ Single-instance only | Redis required for multi-instance |
| Audit logging | ✅ Production-ready | Complete trail |
| Sentry monitoring | ✅ Production-ready | All failures captured |

### Deployment Approval

**Single Instance**: ✅ **APPROVED** (with limitations documented)  
**Multi-Instance**: ❌ **BLOCKED** (Redis migration required)

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Review Before**: Every production deployment

