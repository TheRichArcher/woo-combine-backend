"""
Lightweight abuse protection middleware.

If a client exceeds an abnormal rate on sensitive auth-related endpoints,
respond with a 429 and a simple proof-of-work challenge. Once solved, the
client is allowed to proceed for a short period without additional challenges.

Environment variables:
- ABUSE_PROTECTION_ENABLED: true/false (default: true in production)
- ABUSE_WINDOW_SECONDS: sliding window size (default: 30)
- ABUSE_MAX_REQUESTS: max allowed requests per window (default: 10)
- ABUSE_CHALLENGE_DIFFICULTY: number of leading hex zeros required (default: 4)
- ABUSE_SENSITIVE_PATH_PREFIXES: comma-separated list of prefixes (default: /api/users,/api/test-auth)
"""

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
import time
import os
import hashlib
import secrets
import logging
from collections import deque, defaultdict


def _parse_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _get_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        # starlette's client host
        client_ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("User-Agent", "unknown")
    try:
        ua_hash = hashlib.sha256(ua.encode("utf-8")).hexdigest()[:8]
    except Exception:
        ua_hash = "noua"
    return f"{client_ip}:{ua_hash}"


class AbuseProtectionMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

        env = os.getenv("ENVIRONMENT", "").lower()
        default_enabled = env in ("prod", "production")
        self.enabled = _parse_bool(os.getenv("ABUSE_PROTECTION_ENABLED", "true" if default_enabled else "false"), default_enabled)

        self.window_seconds = int(os.getenv("ABUSE_WINDOW_SECONDS", "30"))
        self.max_requests = int(os.getenv("ABUSE_MAX_REQUESTS", "10"))
        self.difficulty = int(os.getenv("ABUSE_CHALLENGE_DIFFICULTY", "4"))

        prefixes_env = os.getenv("ABUSE_SENSITIVE_PATH_PREFIXES", "/api/users,/api/test-auth")
        self.sensitive_prefixes = [p.strip() for p in prefixes_env.split(",") if p.strip()]

        # per-client request timestamps
        self.client_requests = defaultdict(deque)
        # per-client allowlist expiry after successful challenge
        self.client_allow_until = {}

        logging.info(
            f"[ABUSE] enabled={self.enabled}, window={self.window_seconds}s, max={self.max_requests}, diff={self.difficulty}, prefixes={self.sensitive_prefixes}"
        )

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or not self._is_sensitive_path(request.url.path):
            return await call_next(request)

        now = time.time()
        client_id = _get_client_identifier(request)

        # If client solved a recent challenge, allow until expiry
        allow_until = self.client_allow_until.get(client_id, 0)
        if allow_until and now < allow_until:
            return await call_next(request)

        # Verify proof-of-work answer if provided
        client_answer = request.headers.get("X-Abuse-Answer")
        client_nonce = request.headers.get("X-Abuse-Nonce")
        if client_answer and client_nonce:
            if self._verify_pow(client_nonce, client_answer):
                # allow for 2 minutes after successful solve
                self.client_allow_until[client_id] = now + 120
                return await call_next(request)
            # fall through (invalid answer -> treat as no answer)

        # Sliding window accounting
        timestamps = self.client_requests[client_id]
        timestamps.append(now)
        # prune old entries
        cutoff = now - self.window_seconds
        while timestamps and timestamps[0] < cutoff:
            timestamps.popleft()

        if len(timestamps) > self.max_requests:
            # Issue challenge
            nonce = secrets.token_hex(16)
            challenge = {
                "type": "pow",
                "nonce": nonce,
                "difficulty": self.difficulty,
                "instruction": "Find any ASCII string 'answer' such that sha256(nonce + ':' + answer) starts with N hex zeros, where N=difficulty. Send headers X-Abuse-Nonce and X-Abuse-Answer to proceed.",
            }
            headers = {
                "X-Abuse-Mode": "pow",
                "X-Abuse-Nonce": nonce,
                "Retry-After": "10",
            }
            return JSONResponse(status_code=429, content={"detail": "Challenge required", "challenge": challenge}, headers=headers)

        return await call_next(request)

    def _is_sensitive_path(self, path: str) -> bool:
        path_lower = path.lower()
        return any(path_lower.startswith(p) for p in self.sensitive_prefixes)

    def _verify_pow(self, nonce: str, answer: str) -> bool:
        try:
            digest = hashlib.sha256(f"{nonce}:{answer}".encode("utf-8")).hexdigest()
            return digest.startswith("0" * max(0, self.difficulty))
        except Exception:
            return False


def add_abuse_protection_middleware(app):
    app.add_middleware(AbuseProtectionMiddleware)
    logging.info("Abuse protection middleware configured")


