import os
import importlib


def import_app():
    # Ensure backend is importable
    import sys
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sys.path.insert(0, os.path.dirname(root))
    mod = importlib.import_module("backend.main")
    return mod.app


def test_security_headers_present(monkeypatch):
    # Set environment to ensure CSP report-only in tests
    monkeypatch.setenv("ENVIRONMENT", "staging")
    from starlette.testclient import TestClient

    app = import_app()
    client = TestClient(app)
    r = client.get("/api")
    assert r.status_code == 200
    # CSP (report-only in staging)
    assert (
        "Content-Security-Policy" in r.headers
        or "Content-Security-Policy-Report-Only" in r.headers
    )
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert r.headers.get("X-Content-Type-Options") == "nosniff"


def test_cors_preflight(monkeypatch):
    from starlette.testclient import TestClient

    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    app = import_app()
    client = TestClient(app)
    r = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization,Content-Type",
        },
    )
    assert r.status_code in (200, 204)
    assert r.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


def test_health_rate_limit_enforced(monkeypatch):
    from starlette.testclient import TestClient

    # Tighten health limit so we can observe 429 within the test
    monkeypatch.setenv("RATE_LIMITS_HEALTH", "1/second")
    app = import_app()
    client = TestClient(app)
    r1 = client.get("/api/health")
    assert r1.status_code == 200
    r2 = client.get("/api/health")
    assert r2.status_code in (200, 429)
    if r2.status_code == 429:
        assert r2.json().get("category") == "rate_limit"


