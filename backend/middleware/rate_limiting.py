"""
Rate limiting middleware for WooCombine API
Implements request rate limiting to prevent abuse and ensure fair usage
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request, Response
import hashlib
import logging

# Initialize rate limiter with remote address as key function
limiter = Limiter(key_func=get_remote_address)

# Rate limiting configurations for different endpoint types
RATE_LIMITS = {
    # Authentication endpoints - more restrictive
    "auth": "10/minute",
    
    # User management - moderate limits
    "users": "60/minute", 
    
    # Data retrieval - generous limits for normal usage
    "read": "100/minute",
    
    # Data creation/updates - moderate limits
    "write": "30/minute",
    
    # Bulk operations - more restrictive
    "bulk": "5/minute",
    
    # Health checks - very generous
    "health": "300/minute"
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
        
        # Create JSON response similar to the default handler
        response = JSONResponse(
            {"error": f"Rate limit exceeded: {exc.detail}. Please slow down."},
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