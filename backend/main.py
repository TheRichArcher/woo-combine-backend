from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.players import router as players_router
from backend.routes.leagues import router as leagues_router
# from backend.routes.drills import router as drills_router
# from backend.routes.events import router as events_router
import logging
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from google.cloud import firestore

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://woo-combine.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players_router)
app.include_router(leagues_router)
# app.include_router(drills_router)
# app.include_router(events_router)

@app.get("/health")
def health_check():
    try:
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "details": str(e)}

@app.get("/cors-test")
def cors_test(request: Request):
    return {
        "message": "CORS test endpoint",
        "headers": dict(request.headers)
    }

@app.get("/test-firestore")
def test_firestore():
    try:
        db = firestore.Client()
        test_ref = db.collection("test").document("connectivity-check")
        test_ref.set({"status": "ok"})
        doc = test_ref.get()
        data = doc.to_dict() if doc.exists else None
        return {"success": True, "data": data}
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}

class DebugHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Debug-Header"] = "true"
        return response

app.add_middleware(DebugHeaderMiddleware)

# Path to the folder that contains index.html (adjust if different)
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=DIST_DIR, html=True),
        name="spa",
    )
else:
    logging.warning(f"WARNING: {DIST_DIR} does not exist. Frontend will not be served.") 