from contextlib import asynccontextmanager
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from lifeos.core.config import settings
from lifeos.core.database import engine, init_db
from lifeos.api.auth import router as auth_router
from lifeos.api.intents import router as intents_router
from lifeos.api.missions import router as missions_router
from lifeos.api.commitments import router as commitments_router
from lifeos.api.risks import router as risks_router, actions_router
from lifeos.api.agents import router as agents_router
from lifeos.api.voice import router as voice_router
from lifeos.api.memory import memory_router, integrations_router
from lifeos.api.demo import router as demo_router
from lifeos.api.stream import router as stream_router
from lifeos.api.people import router as people_router
from lifeos.api.research import router as research_router
from lifeos.api.conversations import router as conversations_router
from lifeos.api.documents import router as documents_router
from lifeos.api.artifacts import router as artifacts_router
from lifeos.api.travel import router as travel_router
from lifeos.api.workspaces import router as workspaces_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all is a local/test convenience only. Production schema changes are
    # applied by Alembic before the application starts.
    if settings.APP_ENV != "production":
        await init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Personal Continuity Engine - Never drop the thread.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)


@app.middleware("http")
async def add_request_context(request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    return response

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(intents_router, prefix=settings.API_V1_STR)
app.include_router(missions_router, prefix=settings.API_V1_STR)
app.include_router(commitments_router, prefix=settings.API_V1_STR)
app.include_router(risks_router, prefix=settings.API_V1_STR)
app.include_router(actions_router, prefix=settings.API_V1_STR)
app.include_router(agents_router, prefix=settings.API_V1_STR)
app.include_router(voice_router, prefix=settings.API_V1_STR)
app.include_router(memory_router, prefix=settings.API_V1_STR)
app.include_router(integrations_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
app.include_router(stream_router, prefix=settings.API_V1_STR)
app.include_router(people_router, prefix=settings.API_V1_STR)
app.include_router(research_router, prefix=settings.API_V1_STR)
app.include_router(conversations_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(artifacts_router, prefix=settings.API_V1_STR)
app.include_router(travel_router, prefix=settings.API_V1_STR)
app.include_router(workspaces_router, prefix=settings.API_V1_STR)


@app.get("/api/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "live": True,
        "product": "CONVIA — Personal Continuity Engine",
        "tagline": "Never drop the thread.",
        "version": "1.0.0"
    }


@app.get("/api/ready")
async def readiness_check():
    """Check the required database dependency without exposing provider secrets."""
    database_ready = False
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        database_ready = True
    except Exception:
        database_ready = False

    ai_key = settings.NVIDIA_API_KEY if settings.AI_PROVIDER == "nvidia" else settings.NEBIUS_API_KEY
    ai_model = settings.NVIDIA_NIM_MODEL if settings.AI_PROVIDER == "nvidia" else settings.NEBIUS_NEMOTRON_MODEL
    checks = {
        "database": "ready" if database_ready else "unavailable",
        "inference_provider": "configured" if settings.AI_PROVIDER == "disabled" or (ai_key and ai_model) else "not_configured",
        "tavily": "configured" if settings.TAVILY_API_KEY else "not_configured",
    }
    return {
        "status": "READY" if database_ready else "NOT_READY",
        "checks": checks,
    }

