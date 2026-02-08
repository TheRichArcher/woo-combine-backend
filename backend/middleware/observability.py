import hashlib
import json
import logging
import os
import time
import uuid
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

import contextvars
import importlib

def _import_sentry():
    try:
        sdk = importlib.import_module("sentry_sdk")
        return sdk
    except Exception:
        return None


# Context variables to aggregate per-request metrics
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")
user_id_hash_var: contextvars.ContextVar[str] = contextvars.ContextVar("user_id_hash", default="")
firestore_calls_var: contextvars.ContextVar[int] = contextvars.ContextVar("firestore_calls", default=0)
firestore_total_ms_var: contextvars.ContextVar[float] = contextvars.ContextVar("firestore_total_ms", default=0.0)
cache_hits_delta_var: contextvars.ContextVar[int] = contextvars.ContextVar("cache_hits_delta", default=0)
cache_misses_delta_var: contextvars.ContextVar[int] = contextvars.ContextVar("cache_misses_delta", default=0)


def set_user_id_for_request(user_id: Optional[str]) -> None:
    """Set hashed user id in the request context for structured logs and Sentry."""
    try:
        if not user_id:
            user_id_hash_var.set("")
            return
        digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]
        user_id_hash_var.set(digest)
        _s = _import_sentry()
        if _s:
            with _s.configure_scope() as scope:  # type: ignore[attr-defined]
                scope.set_user({"id": digest})
    except Exception:
        # Never break request on hashing/logging
        pass


def record_firestore_call(duration_ms: float) -> None:
    try:
        firestore_calls = firestore_calls_var.get()
        firestore_total = firestore_total_ms_var.get()
        firestore_calls_var.set(firestore_calls + 1)
        firestore_total_ms_var.set(firestore_total + float(duration_ms))
    except Exception:
        pass


def add_cache_deltas(hits_delta: int = 0, misses_delta: int = 0) -> None:
    try:
        cache_hits_delta_var.set(cache_hits_delta_var.get() + int(hits_delta))
        cache_misses_delta_var.set(cache_misses_delta_var.get() + int(misses_delta))
    except Exception:
        pass


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Middleware to add request id, structured logging, and basic timings."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        # Accept client correlation ID or generate one
        req_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        request_id_var.set(req_id)

        # Attach to Sentry scope and set common tags
        _s = _import_sentry()
        if _s:
            try:
                release = os.getenv("RELEASE") or f"backend@{os.getenv('GIT_COMMIT','unknown')}"
                with _s.configure_scope() as scope:  # type: ignore[attr-defined]
                    scope.set_tag("request_id", req_id)
                    scope.set_tag("endpoint", request.url.path)
                    scope.set_tag("method", request.method)
                    if release:
                        scope.set_tag("release", release)
            except Exception:
                pass

        start_time = time.perf_counter()
        status_code = 500
        error_code = None
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            try:
                response.headers["X-Request-ID"] = req_id
            except Exception:
                pass
            return response
        except Exception as exc:  # Ensure we still log on exceptions
            error_code = type(exc).__name__
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            firestore_calls = firestore_calls_var.get()
            firestore_total_ms = firestore_total_ms_var.get()
            user_hash = user_id_hash_var.get() or ""
            cache_hits = cache_hits_delta_var.get()
            cache_misses = cache_misses_delta_var.get()

            log_payload = {
                "request_id": req_id,
                "endpoint": request.url.path,
                "method": request.method,
                "status": status_code,
                "latency_ms": round(duration_ms, 2),
                "user_id_hash": user_hash,
                "firestore_calls": firestore_calls,
                "firestore_total_ms": round(firestore_total_ms, 2),
                "cache_hits": cache_hits,
                "cache_misses": cache_misses,
                "error_code": error_code,
            }

            # Log as a single line JSON for easy ingestion by log processors
            try:
                logging.info(json.dumps(log_payload))
            except Exception:
                logging.info(f"[REQUEST] {log_payload}")


def init_sentry_if_configured() -> None:
    """Initialize Sentry SDK for FastAPI if DSN is present."""
    dsn = os.getenv("BACKEND_SENTRY_DSN")
    if not dsn:
        return
    try:
        _s = _import_sentry()
        if _s:
            # Lazy import integrations only if SDK present
            from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore
            from sentry_sdk.integrations.starlette import StarletteIntegration  # type: ignore

            release = (
                os.getenv("RELEASE")
                or f"backend@{os.getenv('GIT_COMMIT') or os.getenv('RENDER_GIT_COMMIT') or 'unknown'}"
            )
            environment = os.getenv("SENTRY_ENVIRONMENT", "development")
            traces_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2"))
            profiles_rate = float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.0"))
            _s.init(  # type: ignore[attr-defined]
                dsn=dsn,
                environment=environment,
                release=release,
                send_default_pii=False,
                integrations=[FastApiIntegration(), StarletteIntegration()],
                enable_tracing=True,
                traces_sample_rate=traces_rate,
                profiles_sample_rate=profiles_rate,
            )
            logging.info("[SENTRY] Initialized for backend")
    except Exception as e:
        logging.error(f"[SENTRY] Initialization failed: {e}")


__all__ = [
    "ObservabilityMiddleware",
    "init_sentry_if_configured",
    "request_id_var",
    "user_id_hash_var",
    "set_user_id_for_request",
    "record_firestore_call",
    "add_cache_deltas",
]


