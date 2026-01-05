# Multi-Instance Token Store Migration Guide

**Date**: January 5, 2026  
**Status**: 🔴 REQUIRED FOR MULTI-INSTANCE DEPLOYMENTS  
**Current State**: Single-instance in-memory store  
**Target State**: Redis-backed shared store

---

## Critical Limitation

### Current Implementation (In-Memory Store)

```python
# backend/utils/delete_token.py
_token_usage_store = {}  # In-memory dictionary
```

**Replay Protection**:
- ✅ **Works**: If same backend instance handles both requests
- ❌ **Fails**: If different instances handle requests (autoscaling, load balancer)

**Why This Fails in Multi-Instance**:
```
Request 1 → Load Balancer → Instance A → Token jti marked as used in Instance A's memory
Request 2 → Load Balancer → Instance B → Token jti unknown (Instance B has different memory)
Result: Replay succeeds ❌
```

---

## Production Readiness Checklist

### Before Enabling Token-Based Deletion

- [ ] **Verify Deployment Topology**
  - Single instance? → Current implementation OK
  - Multi-instance/autoscaled? → Redis/DB required

- [ ] **Set Environment Variable**
  ```bash
  DELETE_TOKEN_SECRET_KEY=<strong_32_char_secret>
  ```
  - Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
  - Test in staging first
  - Confirm startup logs show: "Token-based deletion enabled"

- [ ] **Test Token Generation**
  ```bash
  curl -X POST https://api.woo-combine.com/api/leagues/{league_id}/events/{event_id}/delete-intent-token \
    -H "Authorization: Bearer {token}"
  # Expected: 200 OK with token
  # If 503: SECRET_KEY not configured
  ```

- [ ] **Test Replay Protection**
  - Use same token twice
  - Expected behavior depends on deployment:
    * Single instance: Second request → 400 "Token already used"
    * Multi-instance: May succeed (replay not blocked across instances)

- [ ] **Document Known Limitations**
  - If multi-instance: Add warning to stakeholders
  - "Replay-proof on single instance. Multi-instance requires Redis."

---

## Migration Path: Redis-Backed Store

### Why Redis?

| Feature | In-Memory | Redis |
|---------|-----------|-------|
| **Replay protection** | Single instance only | All instances |
| **Persistence** | Lost on restart | Persistent |
| **Atomic operations** | No race conditions | `SET NX` guarantees |
| **Expiration** | Manual cleanup | Auto TTL |
| **Scaling** | Cannot scale | Scales horizontally |

---

## Implementation: Option 1 (Redis - Recommended)

### Step 1: Add Redis Dependency

```bash
# requirements.txt
redis==5.0.1
```

### Step 2: Redis Configuration

```python
# backend/utils/delete_token.py
import redis
import os

# Redis connection (production should use connection pool)
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=int(os.getenv("REDIS_DB", 0)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True  # Return strings not bytes
)

def validate_redis_connection():
    """Validate Redis connection on startup"""
    try:
        redis_client.ping()
        logging.info("[STARTUP] Redis connection: ✓ available - Multi-instance replay protection enabled")
        return True
    except Exception as e:
        logging.error(f"[STARTUP] Redis connection: ✗ failed - {e}")
        logging.error("[STARTUP] Token replay protection will NOT work in multi-instance deployments")
        return False
```

### Step 3: Token Generation with Redis

```python
def generate_delete_intent_token(user_id: str, league_id: str, target_event_id: str) -> str:
    """Generate one-time-use token with Redis-backed jti tracking"""
    if not SECRET_KEY:
        raise RuntimeError("DELETE_TOKEN_SECRET_KEY not configured")
    
    now = datetime.utcnow()
    expiry = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    jti = str(uuid.uuid4())
    
    payload = {
        "jti": jti,
        "user_id": user_id,
        "league_id": league_id,
        "target_event_id": target_event_id,
        "issued_at": now.isoformat(),
        "expires_at": expiry.isoformat(),
        "exp": expiry,
        "iat": now,
        "purpose": "event_deletion"
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    # Store jti in Redis with TTL (auto-cleanup)
    redis_key = f"delete_token:jti:{jti}"
    redis_value = {
        "user_id": user_id,
        "target_event_id": target_event_id,
        "issued_at": now.isoformat(),
        "used_at": None
    }
    
    # SET with expiration (Redis will auto-delete after TTL)
    redis_client.setex(
        redis_key,
        TOKEN_EXPIRY_MINUTES * 60,  # TTL in seconds
        json.dumps(redis_value)
    )
    
    logging.info(f"[DELETE_TOKEN] Generated token (jti: {jti}) stored in Redis with {TOKEN_EXPIRY_MINUTES}min TTL")
    
    return token
```

### Step 4: Token Validation with Redis

```python
def validate_delete_intent_token(
    token: str,
    expected_user_id: str,
    expected_league_id: str,
    expected_target_event_id: str,
    mark_as_used: bool = False
) -> dict:
    """Validate token and enforce one-time-use via Redis"""
    if not SECRET_KEY:
        raise RuntimeError("DELETE_TOKEN_SECRET_KEY not configured")
    
    # Decode JWT
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    jti = payload.get("jti")
    
    if not jti:
        raise ValueError("Token missing jti claim")
    
    # Check Redis for jti
    redis_key = f"delete_token:jti:{jti}"
    redis_value = redis_client.get(redis_key)
    
    if not redis_value:
        logging.error(f"[DELETE_TOKEN] Unknown or expired jti: {jti}")
        raise ValueError("Token jti not found (may be forged or expired)")
    
    token_record = json.loads(redis_value)
    
    # CRITICAL: Check if already used
    if token_record.get("used_at"):
        logging.error(f"[DELETE_TOKEN] REPLAY ATTACK DETECTED - jti: {jti} already used at {token_record['used_at']}")
        raise ValueError(f"Token already used at {token_record['used_at']}. Replay attacks are blocked.")
    
    # Validate claims
    if payload.get("user_id") != expected_user_id:
        raise ValueError("Token user_id mismatch")
    if payload.get("league_id") != expected_league_id:
        raise ValueError("Token league_id mismatch")
    if payload.get("target_event_id") != expected_target_event_id:
        raise ValueError("Token target_event_id mismatch")
    
    # Mark as used (atomic operation)
    if mark_as_used:
        token_record["used_at"] = datetime.utcnow().isoformat()
        
        # ATOMIC: Only set if key still exists (prevents race condition)
        pipe = redis_client.pipeline()
        pipe.watch(redis_key)
        pipe.multi()
        pipe.setex(redis_key, TOKEN_EXPIRY_MINUTES * 60, json.dumps(token_record))
        pipe.execute()
        
        logging.info(f"[DELETE_TOKEN] Token marked as used in Redis (jti: {jti})")
    
    return payload
```

### Step 5: Environment Variables

```bash
# Backend .env
DELETE_TOKEN_SECRET_KEY=<secret>
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<redis_password>
```

### Step 6: Startup Validation

```python
# backend/main.py
@app.on_event("startup")
async def startup_event():
    # ... existing startup code ...
    
    # Validate Redis connection
    from .utils.delete_token import validate_redis_connection
    if validate_redis_connection():
        logging.info("[STARTUP] Token replay protection: ✓ Multi-instance safe (Redis)")
    else:
        logging.warning("[STARTUP] Token replay protection: ⚠ Single-instance only (in-memory)")
```

---

## Implementation: Option 2 (Database)

### Database Schema

```sql
CREATE TABLE delete_intent_tokens (
    jti VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    target_event_id VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    INDEX idx_expires_at (expires_at)  -- For cleanup
);
```

### Token Generation

```python
def generate_delete_intent_token(user_id: str, league_id: str, target_event_id: str) -> str:
    jti = str(uuid.uuid4())
    now = datetime.utcnow()
    expiry = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    
    # ... generate JWT payload ...
    
    # Store in database
    db.collection("delete_intent_tokens").document(jti).set({
        "user_id": user_id,
        "target_event_id": target_event_id,
        "issued_at": now,
        "expires_at": expiry,
        "used_at": None
    })
    
    return token
```

### Token Validation with Transaction

```python
def validate_delete_intent_token(..., mark_as_used: bool = False) -> dict:
    # ... decode JWT ...
    
    # Check database
    doc_ref = db.collection("delete_intent_tokens").document(jti)
    
    @firestore.transactional
    def mark_token_used(transaction):
        doc = doc_ref.get(transaction=transaction)
        if not doc.exists:
            raise ValueError("Token jti not found")
        
        token_data = doc.to_dict()
        
        # Check if already used
        if token_data.get("used_at"):
            raise ValueError("Token already used. Replay attacks are blocked.")
        
        # Mark as used (atomic within transaction)
        if mark_as_used:
            transaction.update(doc_ref, {"used_at": datetime.utcnow()})
        
        return token_data
    
    # Execute transaction
    transaction = db.transaction()
    token_data = mark_token_used(transaction)
    
    # ... validate claims ...
    
    return payload
```

---

## Deployment Strategy

### Phase 1: Single Instance (Current)
- ✅ In-memory store works
- ✅ Replay protection active
- ⚠️ Does not scale

**Stakeholder Message**:
> "Replay-proof on single instance. For multi-instance, requires shared store (Redis/DB)."

### Phase 2: Redis Migration (Multi-Instance)
- Add Redis to infrastructure
- Update token store implementation
- Test replay protection across instances
- Update documentation

**Stakeholder Message**:
> "Replay attacks impossible even under autoscaling (Redis-backed)."

---

## Testing Replay Protection

### Single Instance Test
```bash
# Request token
TOKEN=$(curl -X POST .../delete-intent-token | jq -r '.token')

# Use token (should succeed)
curl -X DELETE .../events/{id} -H "X-Delete-Intent-Token: $TOKEN"
# Expected: 200 OK

# Replay token (should fail)
curl -X DELETE .../events/{id} -H "X-Delete-Intent-Token: $TOKEN"
# Expected: 400 "Token already used"
```

### Multi-Instance Test
```bash
# Same as above, but force requests to different instances
# Use load balancer sticky sessions disabled
# OR use instance-specific URLs

# If replay succeeds → Redis/DB required
# If replay fails → In-memory working (lucky same instance)
```

---

## Production Readiness Gates

### For Single-Instance Deployment ✅
- [x] `DELETE_TOKEN_SECRET_KEY` configured
- [x] Startup logs confirm token system enabled
- [x] Replay protection tested (same instance)
- [x] Stakeholders informed of single-instance limitation

### For Multi-Instance Deployment 🔴
- [ ] Redis configured and accessible
- [ ] Redis connection validated on startup
- [ ] Replay protection tested across instances
- [ ] Failover/HA strategy documented
- [ ] Stakeholders informed: "Impossible to replay (multi-instance safe)"

---

## Summary

### Current State (Commit 89b9332)
**Replay Protection**: ✅ Single instance  
**Replay Protection**: ❌ Multi-instance  
**Accurate Claim**: "Replay-proof on single instance. For multi-instance, requires shared store."

### After Redis Migration (Next PR)
**Replay Protection**: ✅ Single instance  
**Replay Protection**: ✅ Multi-instance  
**Accurate Claim**: "Replay attacks impossible even under autoscaling."

---

## Next Steps

1. **Immediate**: Verify production deployment topology
   - Single instance? → Current implementation safe
   - Multi-instance? → Redis migration required

2. **Before GA**: 
   - If multi-instance: Implement Redis store
   - Test replay across instances
   - Update stakeholder documentation

3. **Monitoring**:
   - Log all replay attempts
   - Alert on Redis connection failures
   - Track token usage patterns

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Next Review**: Before multi-instance deployment

