from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.players import router as players_router
from backend.routes.drills import router as drills_router
from backend.routes.events import router as events_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players_router)
app.include_router(drills_router)
app.include_router(events_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# from routes import players, drills, auth  # To be registered later 