"""
Rate limiting middleware for WooCombine API
Implements request rate limiting to prevent abuse and ensure fair usage
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
import hashlib
import logging
import os

def _normalize_rate_string(rate_value: str, default_value: str) -> str:
    """Normalize human-friendly rate strings like '5/min' to slowapi format '5/minute'."""
    value = (rate_value or default_value).strip()
    # Replace only when shorthand is used exactly at the end
    if value.endswith("/min"):
        value = value[: -len("/min")] + "/minute"
    elif value.endswith("/sec"):
        value = value[: -len("/sec")] + "/second"
    elif value.endswith("/hr"):
        value = value[: -len("/hr")] + "/hour"
    return value

# Defaults if env not provided
_DEFAULTS = {
    # Per requirements
    "auth": "5/minute",
    "users": "300/minute",   # align user reads with general reads
    "read": "300/minute",
    "write": "120/minute",
    "bulk": "30/minute",
    "health": "600/minute",
}

# Rate limiting configurations for different endpoint types (env-overridable)
RATE_LIMITS = {
    # Authentication endpoints
    "auth": _normalize_rate_string(os.getenv("RATE_LIMITS_AUTH", ""), _DEFAULTS["auth"]),
    
    # User management (optional override; fallback to default if not set)
    "users": _normalize_rate_string(os.getenv("RATE_LIMITS_USERS", ""), _DEFAULTS["users"]),
    
    # Data retrieval
    "read": _normalize_rate_string(os.getenv("RATE_LIMITS_READ", ""), _DEFAULTS["read"]),
    
    # Data creation/updates
    "write": _normalize_rate_string(os.getenv("RATE_LIMITS_WRITE", ""), _DEFAULTS["write"]),
    
    # Bulk operations
    "bulk": _normalize_rate_string(os.getenv("RATE_LIMITS_BULK", ""), _DEFAULTS["bulk"]),
    
    # Health checks
    "health": _normalize_rate_string(os.getenv("RATE_LIMITS_HEALTH", ""), _DEFAULTS["health"]),
}

def get_client_identifier(request: Request) -> str:
    """
    Get a unique identifier for the client making the request.
    Uses IP address and User-Agent for better identification.
    """
    # Try to get real IP from headers (for reverse proxy setups)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        client_ip = forwarded_for.split(',')[0].strip()
    else:
        client_ip = get_remote_address(request)
    
    # Add user agent to make identifier more unique
    ua = request.headers.get("User-Agent", "unknown")
    try:
        ua_hash = hashlib.sha256(ua.encode("utf-8")).hexdigest()[:8]
    except Exception:
        ua_hash = "noua"
    return f"{client_ip}:{ua_hash}"

# Create limiter with custom key function
limiter = Limiter(key_func=get_client_identifier)

def create_rate_limit_handler():
    """Create custom rate limit exceeded handler"""
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        from fastapi.responses import JSONResponse
        
        # Create JSON response in standardized format used across the API
        response = JSONResponse(
            {
                "detail": f"Rate limit exceeded: {exc.detail}. Please slow down.",
                "category": "rate_limit"
            },
            status_code=429
        )
        
        # Let slowapi inject the proper headers
        if hasattr(request.app.state, 'limiter') and hasattr(request, 'state') and hasattr(request.state, 'view_rate_limit'):
            response = request.app.state.limiter._inject_headers(
                response, request.state.view_rate_limit
            )
        else:
            # Fallback headers if slowapi injection fails
            response.headers["X-RateLimit-Limit"] = "unknown"
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["Retry-After"] = "60"
        
        # Log rate limit violations for monitoring
        client_id = get_client_identifier(request)
        logging.warning(
            f"Rate limit exceeded for client {client_id} on {request.url.path}. "
            f"Detail: {exc.detail}"
        )
        
        return response
    
    return rate_limit_handler

# Decorators for different rate limiting levels
def auth_rate_limit():
    """Rate limit for authentication endpoints"""
    return limiter.limit(RATE_LIMITS["auth"])

def user_rate_limit():
    """Rate limit for user management endpoints"""
    return limiter.limit(RATE_LIMITS["users"])

def read_rate_limit():
    """Rate limit for read operations"""
    return limiter.limit(RATE_LIMITS["read"])

def write_rate_limit():
    """Rate limit for write operations"""
    return limiter.limit(RATE_LIMITS["write"])

def bulk_rate_limit():
    """Rate limit for bulk operations"""
    return limiter.limit(RATE_LIMITS["bulk"])

def health_rate_limit():
    """Rate limit for health check endpoints"""
    return limiter.limit(RATE_LIMITS["health"])

# Function to add rate limiting to FastAPI app
def add_rate_limiting(app):
    """
    Add rate limiting middleware and handlers to FastAPI app
    """
    # Configure limiter and handlers
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, create_rate_limit_handler())
    # Ensure middleware is added so limits actually apply
    app.add_middleware(SlowAPIMiddleware)
    
    logging.info("Rate limiting middleware configured with limits: %s", RATE_LIMITS)