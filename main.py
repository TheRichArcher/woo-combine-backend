from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from backend.routes import leagues, players, drills, events
app.include_router(leagues.router)
app.include_router(players.router)
app.include_router(drills.router)
app.include_router(events.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# from routes import players, drills, auth  # To be registered later 