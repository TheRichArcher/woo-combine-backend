"""
Security middleware for WooCombine API
Implements security headers and policies to protect against common attacks
"""

from fastapi import Request, Response
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
        response = await call_next(request)
        
        # Add security headers
        self.add_security_headers(response, request)
        
        return response
    
    def add_security_headers(self, response: Response, request: Request):
        """Add comprehensive security headers"""
        
        # Content Security Policy - Protect against XSS
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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