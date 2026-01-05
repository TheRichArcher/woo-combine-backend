"""
Delete Intent Token System

Provides short-lived, cryptographically-signed tokens for event deletion.
Tokens are bound to specific deletion attempts and expire after 5 minutes.

This prevents:
- UI drift (token is bound to specific target_event_id)
- Replay attacks (token expires after 5 minutes)
- Malicious calls (token must be signed by server)
"""

import jwt
from datetime import datetime, timedelta
import os
import logging

# Secret key for JWT signing (should be in environment variable in production)
SECRET_KEY = os.environ.get("DELETE_TOKEN_SECRET_KEY", "CHANGE_THIS_IN_PRODUCTION_USE_ENV_VAR")
ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 5

def generate_delete_intent_token(user_id: str, league_id: str, target_event_id: str) -> str:
    """
    Generate a short-lived delete intent token.
    
    Args:
        user_id: Firebase UID of the user initiating deletion
        league_id: League ID containing the event
        target_event_id: Event ID that will be deleted
    
    Returns:
        JWT token string valid for 5 minutes
    """
    now = datetime.utcnow()
    expiry = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    
    payload = {
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
    
    logging.info(f"[DELETE_TOKEN] Generated token for user {user_id}, event {target_event_id}, expires in {TOKEN_EXPIRY_MINUTES}min")
    
    return token


def validate_delete_intent_token(
    token: str, 
    expected_user_id: str, 
    expected_league_id: str, 
    expected_target_event_id: str
) -> dict:
    """
    Validate a delete intent token and verify its claims.
    
    Args:
        token: JWT token string
        expected_user_id: User ID that should match token
        expected_league_id: League ID that should match token
        expected_target_event_id: Event ID that should match token
    
    Returns:
        dict: Decoded token payload if valid
    
    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid or claims don't match
        ValueError: Claims validation failed
    """
    try:
        # Decode and verify signature + expiration
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
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
        
        logging.info(f"[DELETE_TOKEN] Valid token for user {expected_user_id}, event {expected_target_event_id}")
        
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

