import asyncio
import os
from pathlib import Path
from uuid import uuid4

# All automated tests use an isolated database and never call paid providers.
_TEST_DATABASE_FILE = f"test_convia_{uuid4().hex}.db"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///./{_TEST_DATABASE_FILE}"
os.environ["AUTH_SECRET"] = "test-only-secret-never-use-in-deployment-2026"
os.environ["AI_PROVIDER"] = "disabled"
os.environ["NEBIUS_API_KEY"] = ""
os.environ["NEBIUS_NEMOTRON_MODEL"] = ""
os.environ["NEBIUS_FAST_MODEL"] = ""
os.environ["NEBIUS_REASONING_MODEL"] = ""
os.environ["NVIDIA_API_KEY"] = ""
os.environ["NVIDIA_NIM_MODEL"] = ""
os.environ["NVIDIA_NIM_FAST_MODEL"] = ""
os.environ["NVIDIA_NIM_REASONING_MODEL"] = ""
os.environ["TAVILY_API_KEY"] = ""


def pytest_sessionfinish(session, exitstatus):
    """Close the test engine before removing this run's isolated SQLite file."""
    try:
        from lifeos.core.database import engine

        asyncio.run(engine.dispose())
    finally:
        Path(_TEST_DATABASE_FILE).unlink(missing_ok=True)
