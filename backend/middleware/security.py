"""
Security middleware for WooCombine API
Implements security headers and policies to protect against common attacks
"""

from fastapi import Request, Response
from starlette.responses import Response as StarletteResponse, RedirectResponse
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

        # Enforce HTTPS in production-like environments (skip localhost and health checks)
        try:
            force_https_env = os.getenv("FORCE_HTTPS", "true").lower() in ("1", "true", "yes")
            forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
            hostname = (request.url.hostname or request.headers.get("host", "").split(":")[0]).lower()
            is_localhost = hostname in ("localhost", "127.0.0.1")
            is_health = request.url.path in ("/health", "/api/health")
            if force_https_env and not is_localhost and not is_health and forwarded_proto == "http" and request.url.scheme == "http":
                https_url = str(request.url).replace("http://", "https://", 1)
                return RedirectResponse(url=https_url, status_code=308)
        except Exception:
            # Never block requests if redirect computation fails
            pass

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
        
        # Content Security Policy - Protect against XSS (report-only in staging)
        env = os.getenv("ENVIRONMENT", "").lower()
        report_only = os.getenv("CSP_REPORT_ONLY", "false").lower() in ("1", "true", "yes") or env == "staging"

        # Derive backend origin for connect-src if not provided
        request_origin = f"{request.url.scheme}://{request.url.netloc}" if getattr(request, "url", None) else ""

        # Determine whether to allow inline scripts (only if absolutely required, e.g., Vite in dev)
        allow_unsafe_inline_scripts = os.getenv("CSP_ALLOW_UNSAFE_INLINE_SCRIPTS", "false").lower() in ("1", "true", "yes")

        script_src_values = ["'self'"] + (["'unsafe-inline'"] if allow_unsafe_inline_scripts else [])
        style_src_values = ["'self'", "'unsafe-inline'"]
        img_src_values = ["'self'", "data:"]

        # Build connect-src: always include 'self' and backend origin; allow Firebase endpoints by default
        connect_src_values = ["'self'"]
        if request_origin:
            connect_src_values.append(request_origin)
        # Additional connect-src from env (comma-separated)
        extra_connect = [v.strip() for v in os.getenv("CSP_CONNECT_SRC", "").split(",") if v.strip()]
        connect_src_values.extend(extra_connect)
        # Common Firebase endpoints (frontend may call them)
        connect_src_values.extend([
            "https://*.googleapis.com",
            "https://*.firebaseio.com",
            "wss://*.firebaseio.com",
        ])

        csp_directives = [
            "default-src 'self'",
            f"script-src {' '.join(script_src_values)}",
            f"style-src {' '.join(style_src_values)}",
            f"img-src {' '.join(img_src_values)}",
            "object-src 'none'",
            "base-uri 'none'",
            f"connect-src {' '.join(dict.fromkeys(connect_src_values))}",  # dedupe while preserving order
            "frame-ancestors 'none'",
        ]

        # Optional reporting endpoint
        report_uri = os.getenv("CSP_REPORT_URI")
        if report_uri:
            csp_directives.append(f"report-uri {report_uri}")

        csp_header_name = "Content-Security-Policy-Report-Only" if report_only else "Content-Security-Policy"
        response.headers[csp_header_name] = "; ".join(csp_directives)
        
        # X-Frame-Options - Protect against clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-Content-Type-Options - Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-XSS-Protection - legacy header; harmless for older browsers
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
    # Retained for backward compatibility: keep behavior but log deprecation
    logging.warning("add_security_middleware is deprecated. Use add_security_headers_middleware and add_request_validation_middleware to control ordering.")
    app.add_middleware(SecurityHeadersMiddleware, config=config)
    app.add_middleware(RequestValidationMiddleware, config=config)
    logging.info("Security middleware (headers + request validation) configured")

def add_security_headers_middleware(app, config=None):
    """Add only the security headers middleware."""
    app.add_middleware(SecurityHeadersMiddleware, config=config)
    logging.info("Security headers middleware configured")

def add_request_validation_middleware(app, config=None):
    """Add only the request validation middleware (should come after rate limiting)."""
    app.add_middleware(RequestValidationMiddleware, config=config)
    logging.info("Request validation middleware configured")