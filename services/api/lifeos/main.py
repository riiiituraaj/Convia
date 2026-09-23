from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from lifeos.core.config import settings
from lifeos.core.database import init_db
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
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
    allow_origins=["*"], # Allow development frontends
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "product": "CONVIA — Personal Continuity Engine",
        "tagline": "Never drop the thread.",
        "version": "1.0.0"
    }

