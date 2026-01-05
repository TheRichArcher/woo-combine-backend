# Production Operations Runbook

**Last Updated**: January 5, 2026  
**Status**: Production guidelines for WooCombine platform

---

## ⚠️ CRITICAL: Deployment Safety Guarantees

### Event Deletion System - Single Instance Requirement

**Deletion safety guarantees assume a single backend instance. Autoscaling requires Redis-backed token store.**

| Configuration | Replay Protection | Status | Action Required |
|--------------|-------------------|--------|-----------------|
| **Single Instance** | ✅ Safe | Production-ready | Set `DELETE_TOKEN_SECRET_KEY` |
| **Multi-Instance** | ❌ Unsafe | Blocked | Redis migration required |

**Why This Matters**:
- Event deletion uses in-memory token tracking (`_token_usage_store`)
- Different instances have separate memory spaces
- Token used on Instance A can be replayed on Instance B
- This bypasses the one-time-use guarantee
- **Result**: Data integrity violation

**Current Configuration** (Safe):
```yaml
# render.yaml
numInstances: 1  # Single instance - replay protection works
```

**Before Scaling** (REQUIRED):
```
IF numInstances > 1 OR autoscaling enabled:
  1. Implement Redis-backed token store
  2. See: docs/reports/MULTI_INSTANCE_TOKEN_STORE.md
  3. Set REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
  4. Verify startup logs: "Multi-instance replay protection enabled"
  5. Test replay attack across instances (must fail)
  6. THEN enable scaling
```

---

## Pre-Deployment Checklist

### Every Deployment

- [ ] **Verify deployment topology**
  - Check: Single instance OR Redis configured
  - Fail if: Multi-instance without Redis

- [ ] **Confirm environment variables**
  ```bash
  # Required for all deployments
  DELETE_TOKEN_SECRET_KEY=<set>
  
  # Required if multi-instance
  REDIS_HOST=<set>
  REDIS_PORT=<set>
  REDIS_PASSWORD=<set>
  ```

- [ ] **Check startup logs**
  ```
  Expected (Single Instance):
  [STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured
  [STARTUP] Token replay protection: ⚠ Single-instance only
  
  Expected (Multi-Instance with Redis):
  [STARTUP] DELETE_TOKEN_SECRET_KEY: ✓ configured
  [STARTUP] Redis connection: ✓ available
  [STARTUP] Token replay protection: ✓ Multi-instance safe
  ```

- [ ] **Verify health check**
  ```bash
  curl https://woo-combine-backend.onrender.com/health
  # Expected: 200 OK
  ```

---

## Scaling Operations

### ⚠️ STOP: Before Enabling Autoscaling

**DO NOT proceed without completing ALL steps below.**

#### Step 1: Verify Current Configuration
```bash
# Check render.yaml
grep -A 5 "numInstances" render.yaml
# Should show: numInstances: 1 (or not set)

# Check if autoscaling enabled in Render dashboard
# Navigate to: Service → Settings → Scaling
# Should show: Manual scaling (not autoscaling)
```

#### Step 2: Implement Redis Store
```bash
# 1. Deploy Redis infrastructure
# Render: Add Redis add-on
# AWS: Deploy ElastiCache
# Kubernetes: Deploy Redis Helm chart

# 2. Update backend code
# Follow: docs/reports/MULTI_INSTANCE_TOKEN_STORE.md
# Replace _token_usage_store with Redis operations

# 3. Set environment variables
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<secure_password>

# 4. Deploy to staging first
# Test replay protection across instances
```

#### Step 3: Verify Multi-Instance Safety
```bash
# Test 1: Generate token
TOKEN=$(curl -X POST .../delete-intent-token | jq -r '.token')

# Test 2: Use token (should succeed)
curl -X DELETE .../events/{id} -H "X-Delete-Intent-Token: $TOKEN"
# Expected: 200 OK

# Test 3: Force requests to different instances
# Use load balancer without sticky sessions
# OR use instance-specific URLs

# Test 4: Replay token (MUST FAIL)
curl -X DELETE .../events/{id_2} -H "X-Delete-Intent-Token: $TOKEN"
# Expected: 400 "Token already used"
# If 200 OK: Redis not working, DO NOT SCALE
```

#### Step 4: Enable Scaling (Only After Steps 1-3)
```yaml
# render.yaml
- type: web
  name: woo-combine-backend
  scaling:
    minInstances: 2
    maxInstances: 4
    targetCPU: 60
    targetMemory: 70
```

#### Step 5: Monitor Post-Scale
```bash
# Check startup logs on ALL instances
# Should see on EVERY instance:
[STARTUP] Redis connection: ✓ available
[STARTUP] Token replay protection: ✓ Multi-instance safe

# Monitor for replay attempts
# Should see: 0 successful replays
```

---

## Emergency Rollback Procedures

### Scenario: Scaled Without Redis (CRITICAL)

**Symptoms**:
- Multiple instances running
- Startup logs show: "Single-instance only (in-memory)"
- Token replay attacks may be succeeding

**Immediate Action** (< 5 minutes):
```bash
# 1. Force scale down to 1 instance
render services scale woo-combine-backend --replicas 1

# OR in Render dashboard:
# Service → Settings → Scaling → Manual: 1 instance

# 2. Verify single instance running
render services status woo-combine-backend

# 3. Check logs
render logs --tail 100
# Verify: "Token replay protection: ⚠ Single-instance only"

# 4. Monitor for successful startup
# Health check should return 200 OK

# 5. Notify stakeholders
# Message: "Temporarily scaled to single instance for data integrity"
```

**Next Steps** (< 24 hours):
1. Post-incident review
2. Implement Redis migration
3. Test in staging with multiple instances
4. Re-enable scaling only after verification

---

## Monitoring & Alerts

### Critical Metrics

**Token System Health**:
- Token generation success rate (should be 100%)
- Token validation success rate
- Replay attempt count (should be 0 or rare)
- Token endpoint 503 errors (indicates SECRET_KEY issue)

**Scaling Safety**:
- Number of backend instances (alert if >1 without Redis)
- Redis connection status (if multi-instance)
- Startup log pattern: "Single-instance only" (alert if multiple instances)

**Suggested Alerts**:
```yaml
# Alert 1: Multi-instance without Redis
Condition: instance_count > 1 AND log contains "Single-instance only"
Severity: CRITICAL
Action: Page on-call, force scale down

# Alert 2: Token endpoint failing
Condition: /delete-intent-token returns 503
Severity: HIGH
Action: Check DELETE_TOKEN_SECRET_KEY

# Alert 3: High replay attempts
Condition: replay_attempt_count > 10/hour
Severity: MEDIUM
Action: Investigate potential attack
```

---

## Environment Variables Reference

### Required for All Deployments

| Variable | Purpose | How to Generate | Example |
|----------|---------|----------------|---------|
| `DELETE_TOKEN_SECRET_KEY` | JWT signing | `python -c "import secrets; print(secrets.token_urlsafe(32))"` | `kN8zP2mQ...` |

**Set in Render**:
1. Dashboard → Service → Environment
2. Add variable
3. Save → Redeploy

### Required for Multi-Instance Only

| Variable | Purpose | Example |
|----------|---------|---------|
| `REDIS_HOST` | Redis server | `redis.example.com` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis auth | `<secure>` |

---

## Troubleshooting

### Issue: Token Generation Returns 503

**Symptoms**: `/delete-intent-token` returns 503 Service Unavailable

**Diagnosis**:
```bash
# Check startup logs
render logs | grep DELETE_TOKEN_SECRET_KEY
# Look for: "✗ not set"
```

**Fix**:
```bash
# Set environment variable in Render dashboard
# Generate secret:
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Add to Render → Environment → DELETE_TOKEN_SECRET_KEY
# Redeploy service
```

---

### Issue: Replay Attacks Succeeding

**Symptoms**: Same token works multiple times

**Diagnosis**:
```bash
# Check deployment topology
render services status | grep Instances
# If > 1: Redis required

# Check startup logs
render logs | grep "replay protection"
# If "Single-instance only" with multiple instances: UNSAFE
```

**Fix**:
```bash
# Immediate: Scale to 1 instance
render services scale woo-combine-backend --replicas 1

# Long-term: Implement Redis migration
# See: docs/reports/MULTI_INSTANCE_TOKEN_STORE.md
```

---

### Issue: Redis Connection Failures

**Symptoms**: Logs show "Redis connection: ✗ failed"

**Diagnosis**:
```bash
# Check Redis status
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping
# Expected: PONG

# Check network connectivity
nc -zv $REDIS_HOST $REDIS_PORT
```

**Fix**:
```bash
# Verify Redis is running
# Check firewall rules
# Verify credentials in environment variables
```

---

## Documentation References

| Topic | Document | Purpose |
|-------|----------|---------|
| Multi-instance migration | `docs/reports/MULTI_INSTANCE_TOKEN_STORE.md` | Redis implementation guide |
| Production readiness | `docs/deployment/PRODUCTION_READINESS_DELETION.md` | Pre-deployment checklist |
| Verification tests | `docs/qa/DELETE_VERIFICATION_CHECKLIST.md` | Testing procedures |
| Complete implementation | `docs/reports/FINAL_BULLETPROOF_DELETION_SUMMARY.md` | Full technical details |

---

## Contact & Escalation

### Data Integrity Issues (P0)
- Immediate: Page on-call engineer
- Escalate if: Multi-instance without Redis detected
- Action: Force scale to 1 instance

### Token System Issues (P1)
- Investigate within 1 hour
- Escalate if: Cannot resolve in 4 hours

---

## Compliance & Audit

### Regular Reviews (Monthly)

- [ ] Verify deployment topology matches documentation
- [ ] Confirm environment variables set correctly
- [ ] Review startup logs for warnings
- [ ] Check for any scaling configuration changes
- [ ] Verify Redis health (if multi-instance)

### Change Control

**Before ANY scaling changes**:
1. Review this runbook
2. Verify Redis requirements
3. Test in staging
4. Document change rationale
5. Obtain approval

---

## Summary

### ✅ Production-Safe Configuration (Current)

```
Deployment: Single instance
Replay Protection: ✅ Works
Environment: DELETE_TOKEN_SECRET_KEY set
Status: Production-ready
```

### ❌ UNSAFE Configuration (DO NOT DEPLOY)

```
Deployment: Multiple instances
Redis: Not configured
Replay Protection: ❌ Broken
Status: BLOCKED - Data integrity at risk
```

### Next Steps for Scaling

1. Read: `docs/reports/MULTI_INSTANCE_TOKEN_STORE.md`
2. Deploy: Redis infrastructure
3. Implement: Redis-backed token store
4. Test: Replay protection across instances
5. Monitor: Post-scale metrics
6. **Only then**: Enable autoscaling

---

**Remember**: Data integrity is non-negotiable. When in doubt, stay single-instance.

**Document Version**: 1.0  
**Last Audit**: January 5, 2026  
**Next Review**: Before any scaling changes

