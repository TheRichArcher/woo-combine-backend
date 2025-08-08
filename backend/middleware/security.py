"""
Security middleware for WooCombine API
Implements security headers and policies to protect against common attacks
"""

from fastapi import Request, Response
from starlette.responses import Response as StarletteResponse
import os
import re
from starlette.middleware.base import BaseHTTPMiddleware
import logging

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    """
    
    def __init__(self, app, config=None):
        super().__init__(app)
        self.config = config or {}
        
    async def dispatch(self, request: Request, call_next):
        # Basic CORS handling at the edge to guarantee headers for all responses
        origin = request.headers.get("origin", "")
        # Build allowed origins from env (same as main.py) with safe defaults
        allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
        allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()] or [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX") or r"^https://(www\.)?woo-combine\.com$"

        def is_origin_allowed(o: str) -> bool:
            try:
                if o in allowed_origins:
                    return True
                return re.match(allowed_origin_regex, o) is not None
            except Exception:
                return False

        cors_headers = {}
        if origin and is_origin_allowed(origin):
            cors_headers["Access-Control-Allow-Origin"] = origin
            cors_headers["Vary"] = "Origin"
            cors_headers["Access-Control-Allow-Credentials"] = "false"
            cors_headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
            # Be permissive on headers to avoid preflight failures
            cors_headers["Access-Control-Allow-Headers"] = request.headers.get(
                "access-control-request-headers", "Authorization,Content-Type"
            )

        # Short-circuit preflight with proper CORS headers
        if request.method == "OPTIONS":
            return StarletteResponse(status_code=204, headers=cors_headers)

        # PERFORMANCE OPTIMIZATION: Skip heavy header processing for auth endpoints
        # that are called frequently during onboarding
        is_auth_endpoint = (
            request.url.path in ['/api/users/me', '/api/warmup', '/api/health'] or
            request.url.path.startswith('/api/leagues/me')
        )
        
        response = await call_next(request)

        # Ensure CORS headers are present on all responses when allowed
        try:
            for k, v in cors_headers.items():
                response.headers[k] = v
        except Exception:
            pass
        
        if is_auth_endpoint:
            # Minimal headers for auth endpoints (faster processing)
            response.headers["X-API-Version"] = "1.0.2"
            response.headers["X-Content-Type-Options"] = "nosniff"
            if "Server" in response.headers:
                del response.headers["Server"]
        else:
            # Full security headers for other endpoints
            self.add_security_headers(response, request)
        
        return response
    
    def add_security_headers(self, response: Response, request: Request):
        """Add comprehensive security headers"""
        
        # Content Security Policy - Protect against XSS
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' https://apis.google.com https://www.gstatic.com",
            "style-src 'self' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://woo-combine-backend.onrender.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # X-Frame-Options - Protect against clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-Content-Type-Options - Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-XSS-Protection - Enable XSS filtering
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy - Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Strict-Transport-Security - Enforce HTTPS (only for HTTPS requests)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Permissions-Policy - Control browser features
        permissions_policies = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "gyroscope=()",
            "magnetometer=()",
            "microphone=()",
            "payment=()",
            "usb=()"
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policies)
        
        # Remove server information
        if "Server" in response.headers:
            del response.headers["Server"]
        
        # Add custom security header for API identification
        response.headers["X-API-Version"] = "1.0.2"
        response.headers["X-Security-Headers"] = "enabled"

class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request validation and security checks
    """
    
    def __init__(self, app, config=None):
        super().__init__(app)
        self.config = config or {}
        self.max_request_size = self.config.get('max_request_size', 10 * 1024 * 1024)  # 10MB
        
    async def dispatch(self, request: Request, call_next):
        # PERFORMANCE OPTIMIZATION: Skip validation for auth endpoints to reduce latency
        is_auth_endpoint = (
            request.url.path in ['/api/users/me', '/api/warmup', '/api/health'] or
            request.url.path.startswith('/api/leagues/me')
        )
        
        if not is_auth_endpoint:
            # Full validation for non-auth endpoints
            # Validate request size
            if hasattr(request, 'headers'):
                content_length = request.headers.get('content-length')
                if content_length and int(content_length) > self.max_request_size:
                    logging.warning(f"Request too large: {content_length} bytes from {request.client}")
                    return Response(
                        content="Request too large",
                        status_code=413,
                        headers={"Content-Type": "text/plain"}
                    )
            
            # Validate request path for suspicious patterns
            if self.is_suspicious_path(request.url.path):
                logging.warning(f"Suspicious request path: {request.url.path} from {request.client}")
                return Response(
                    content="Invalid request",
                    status_code=400,
                    headers={"Content-Type": "text/plain"}
                )
            
            # Validate user agent (basic bot detection)
            user_agent = request.headers.get('user-agent', '')
            if self.is_suspicious_user_agent(user_agent):
                logging.warning(f"Suspicious user agent: {user_agent} from {request.client}")
                return Response(
                    content="Invalid request",
                    status_code=400,
                    headers={"Content-Type": "text/plain"}
                )
        
        response = await call_next(request)
        return response
    
    def is_suspicious_path(self, path: str) -> bool:
        """Check if the request path contains suspicious patterns"""
        suspicious_patterns = [
            '../',  # Path traversal
            '..\\',  # Windows path traversal
            '/etc/',  # Linux system files
            '/proc/',  # Linux process files
            'wp-admin',  # WordPress admin
            'phpMyAdmin',  # phpMyAdmin
            '.php',  # PHP files
            '.asp',  # ASP files
            '.jsp',  # JSP files
            'sql-injection',  # SQL injection attempts
            '<script',  # XSS attempts
            'javascript:',  # JavaScript injection
        ]
        
        path_lower = path.lower()
        return any(pattern in path_lower for pattern in suspicious_patterns)
    
    def is_suspicious_user_agent(self, user_agent: str) -> bool:
        """Check if the user agent appears suspicious"""
        if not user_agent or len(user_agent) < 10:
            return True
        
        suspicious_agents = [
            'bot',
            'crawler',
            'spider',
            'scraper',
            'scanner',
            'curl',
            'wget',
            'python-requests',
            'postman'
        ]
        
        # Allow legitimate browsers and our test tools
        allowed_agents = [
            'mozilla',
            'chrome',
            'safari',
            'firefox',
            'edge',
            'jest',
            'testing'
        ]
        
        user_agent_lower = user_agent.lower()
        
        # If it contains allowed agent, it's okay
        if any(agent in user_agent_lower for agent in allowed_agents):
            return False
        
        # If it contains suspicious agent, it's suspicious
        return any(agent in user_agent_lower for agent in suspicious_agents)

def add_security_middleware(app, config=None):
    """
    Add security middleware to FastAPI app
    
    Args:
        app: FastAPI application instance
        config: Optional configuration dictionary
    """
    # Add request validation middleware first
    app.add_middleware(RequestValidationMiddleware, config=config)
    
    # Add security headers middleware
    app.add_middleware(SecurityHeadersMiddleware, config=config)
    
    logging.info("Security middleware configured successfully")