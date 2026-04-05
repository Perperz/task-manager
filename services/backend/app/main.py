# services/backend/app/main.py

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import connect_db, close_db
from app.routers import auth, tasks, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="Task Manager API",
    description="A full-featured task management REST API built with FastAPI and MongoDB.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---- CORS ----
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(users.router)


# ---- Health & Info ----

@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint for container orchestration probes."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/", tags=["system"])
async def root():
    """API information and quick links."""
    return {
        "name": "Task Manager API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
