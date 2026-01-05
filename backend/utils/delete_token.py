"""
Delete Intent Token System

Provides short-lived, one-time-use tokens for event deletion.
Tokens are bound to specific deletion attempts and can only be used once.

This prevents:
- UI drift (token is bound to specific target_event_id)
- Replay attacks (token can only be used once via jti tracking)
- Malicious calls (token must be signed by server)
"""

import jwt
from datetime import datetime, timedelta
import os
import logging
import uuid
from typing import Optional

# Secret key for JWT signing (REQUIRED in production)
SECRET_KEY = os.environ.get("DELETE_TOKEN_SECRET_KEY")
ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 5

# In-memory token usage store (production should use Redis or database)
# Structure: {jti: {"user_id": str, "target_event_id": str, "expires_at": datetime, "used_at": datetime|None}}
_token_usage_store = {}

def validate_secret_key():
    """
    Validate that DELETE_TOKEN_SECRET_KEY is set.
    Called on application startup to fail fast if misconfigured.
    """
    if not SECRET_KEY:
        error_msg = (
            "CRITICAL: DELETE_TOKEN_SECRET_KEY environment variable not set. "
            "Delete intent token system will be disabled. "
            "Set this variable to enable secure token-based deletion."
        )
        logging.error(error_msg)
        return False
    
    if SECRET_KEY == "CHANGE_THIS_IN_PRODUCTION_USE_ENV_VAR":
        error_msg = (
            "WARNING: DELETE_TOKEN_SECRET_KEY is set to default value. "
            "This is insecure for production. Generate a strong secret key."
        )
        logging.warning(error_msg)
    
    return True

def generate_delete_intent_token(user_id: str, league_id: str, target_event_id: str) -> str:
    """
    Generate a short-lived, one-time-use delete intent token.
    
    Args:
        user_id: Firebase UID of the user initiating deletion
        league_id: League ID containing the event
        target_event_id: Event ID that will be deleted
    
    Returns:
        JWT token string valid for 5 minutes (one-time use)
    
    Raises:
        RuntimeError: If DELETE_TOKEN_SECRET_KEY not configured
    """
    if not SECRET_KEY:
        raise RuntimeError("DELETE_TOKEN_SECRET_KEY not configured. Cannot generate tokens.")
    
    now = datetime.utcnow()
    expiry = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    
    # Generate unique jti (JWT ID) for one-time-use tracking
    jti = str(uuid.uuid4())
    
    payload = {
        "jti": jti,  # CRITICAL: Unique ID for one-time-use validation
        "user_id": user_id,
        "league_id": league_id,
        "target_event_id": target_event_id,
        "issued_at": now.isoformat(),
        "expires_at": expiry.isoformat(),
        "exp": expiry,  # JWT standard expiration claim
        "iat": now,     # JWT standard issued-at claim
        "purpose": "event_deletion"
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    # Store jti for one-time-use validation
    _token_usage_store[jti] = {
        "user_id": user_id,
        "target_event_id": target_event_id,
        "expires_at": expiry,
        "used_at": None  # Will be set when token is used
    }
    
    logging.info(f"[DELETE_TOKEN] Generated one-time token (jti: {jti}) for user {user_id}, event {target_event_id}, expires in {TOKEN_EXPIRY_MINUTES}min")
    
    return token


def validate_delete_intent_token(
    token: str, 
    expected_user_id: str, 
    expected_league_id: str, 
    expected_target_event_id: str,
    mark_as_used: bool = False
) -> dict:
    """
    Validate a delete intent token and verify it's one-time-use.
    
    Args:
        token: JWT token string
        expected_user_id: User ID that should match token
        expected_league_id: League ID that should match token
        expected_target_event_id: Event ID that should match token
        mark_as_used: If True, mark token as used (prevents replay)
    
    Returns:
        dict: Decoded token payload if valid
    
    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid or claims don't match
        ValueError: Claims validation failed or token already used
        RuntimeError: If DELETE_TOKEN_SECRET_KEY not configured
    """
    if not SECRET_KEY:
        raise RuntimeError("DELETE_TOKEN_SECRET_KEY not configured. Cannot validate tokens.")
    
    try:
        # Decode and verify signature + expiration
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # CRITICAL: Verify jti (JWT ID) for one-time-use
        jti = payload.get("jti")
        if not jti:
            logging.error(f"[DELETE_TOKEN] Missing jti claim in token")
            raise ValueError("Token missing jti claim (not a valid delete intent token)")
        
        # Check if jti exists in usage store
        if jti not in _token_usage_store:
            logging.error(f"[DELETE_TOKEN] Unknown jti: {jti} - Token may be forged or expired cleanup occurred")
            raise ValueError("Token jti not found (token may be forged or too old)")
        
        token_record = _token_usage_store[jti]
        
        # CRITICAL: Check if token already used (prevent replay)
        if token_record["used_at"] is not None:
            logging.error(f"[DELETE_TOKEN] REPLAY ATTACK DETECTED - jti: {jti} already used at {token_record['used_at']}")
            raise ValueError(f"Token already used at {token_record['used_at'].isoformat()}. Replay attacks are blocked.")
        
        # Verify purpose
        if payload.get("purpose") != "event_deletion":
            raise ValueError(f"Invalid token purpose: {payload.get('purpose')}")
        
        # Verify user_id claim
        if payload.get("user_id") != expected_user_id:
            logging.error(f"[DELETE_TOKEN] User ID mismatch - Token: {payload.get('user_id')}, Expected: {expected_user_id}")
            raise ValueError(f"Token user_id mismatch")
        
        # Verify league_id claim
        if payload.get("league_id") != expected_league_id:
            logging.error(f"[DELETE_TOKEN] League ID mismatch - Token: {payload.get('league_id')}, Expected: {expected_league_id}")
            raise ValueError(f"Token league_id mismatch")
        
        # Verify target_event_id claim (CRITICAL)
        if payload.get("target_event_id") != expected_target_event_id:
            logging.error(f"[DELETE_TOKEN] Target event ID mismatch - Token: {payload.get('target_event_id')}, Expected: {expected_target_event_id}")
            raise ValueError(f"Token target_event_id mismatch")
        
        # Mark token as used if requested (prevents replay)
        if mark_as_used:
            token_record["used_at"] = datetime.utcnow()
            logging.info(f"[DELETE_TOKEN] Token marked as used (jti: {jti}) - Replay now blocked")
        
        logging.info(f"[DELETE_TOKEN] Valid one-time token (jti: {jti}) for user {expected_user_id}, event {expected_target_event_id}")
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logging.warning(f"[DELETE_TOKEN] Expired token for user {expected_user_id}, event {expected_target_event_id}")
        raise
    except jwt.InvalidTokenError as e:
        logging.error(f"[DELETE_TOKEN] Invalid token: {e}")
        raise
    except ValueError as e:
        logging.error(f"[DELETE_TOKEN] Token validation failed: {e}")
        raise


def cleanup_expired_tokens():
    """
    Remove expired tokens from usage store to prevent memory leak.
    Should be called periodically (e.g., via background task).
    """
    now = datetime.utcnow()
    expired_jtis = [
        jti for jti, record in _token_usage_store.items()
        if record["expires_at"] < now
    ]
    
    for jti in expired_jtis:
        del _token_usage_store[jti]
    
    if expired_jtis:
        logging.info(f"[DELETE_TOKEN] Cleaned up {len(expired_jtis)} expired tokens from usage store")
    
    return len(expired_jtis)

