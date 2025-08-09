from fastapi.testclient import TestClient
from backend.main import app

# Minimal smoke tests for contract health endpoints
client = TestClient(app)


def test_health_root():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "running")


def test_api_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "firestore" in data


def test_meta():
    r = client.get("/api/meta")
    assert r.status_code == 200
    data = r.json()
    assert "version" in data


