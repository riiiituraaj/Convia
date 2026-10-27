# CONVIA Project Overview

**Updated:** 2026-10-26  
**Project path:** `D:\Convia`

CONVIA is a personal continuity workspace. It combines authenticated conversations with saved commitments, missions, memories, documents, research, risks, agent runs, and reusable artifacts. The checkout has working product slices, but it is not yet the fully autonomous operating system described in the master build prompt.

## Product surfaces

- **Conversations:** Persisted multi-turn messages; active travel constraints; retrieval of relevant user-visible memories, commitments, missions, document passages, and saved research; request IDs prevent duplicate turns after retries.
- **Missions and commitments:** Create and review goals, task commitments, relationships, risks, and saved status history.
- **Research:** Optional Tavily search; normalized source records and durable sessions; source-linked synthesis; reopen, delete, or convert sessions to artifacts and missions.
- **Documents:** Private, account-scoped uploads for PDF, DOCX, PPTX, XLSX, TXT, Markdown, and CSV; bounded extraction, lexical lookup, downloads, deletion, and opt-in AI questions and summaries.
- **Document Studio:** Eight summary modes, extracted-text previews, comparison of up to five documents, and citation labels checked against extracted passages.
- **Knowledge Vault and Context Packs:** Editable, searchable saved notes with validated provenance, plus objective-focused packs that resume with only explicitly attached records.
- **Studio:** Evidence-constrained meeting action drafts, weighted decision scoring, provider-backed explain/write/learn/project-plan drafts, safe CSV/XLSX profiling, and an on-demand saved-data briefing.
- **Playbooks:** User-owned templates limited to registered agent tools; runs hand off to the persisted agent runner.
- **Agent Center:** Persisted plans and step states; registered Tavily, document lookup, mission, artifact, and approval-record tools; pause, resume, cancel, and restricted retry controls.
- **Library:** Reopen, inspect, export, and delete research briefs and agent plan artifacts.
- **Travel search:** Flight and hotel forms provide official search links without fabricated offers. Provider credentials are not enough to enable live inventory or booking.
- **Voice:** Browser speech recognition and synthesis where supported. Optional NVIDIA Parakeet transcription uploads audio only after the user selects the recording action.
- **Security:** Protected workspace routes require an active account. Resource reads and writes are scoped to the authenticated user.

## Architecture

```text
Next.js browser app
      │ authenticated HTTP / SSE
      ▼
FastAPI API ─── optional Nebius or NVIDIA inference
      ├──────── optional Tavily Search
      ├──────── SQLAlchemy database + Alembic migrations
      └──────── private document storage volume
```

- Frontend: Next.js 14 and React in `apps/web`.
- Backend: FastAPI, SQLAlchemy async, and Pydantic in `services/api`.
- Database: SQLite in local/test setups; PostgreSQL in the local Compose topology.
- Migrations: `services/api/migrations/versions`.
- Document originals: `DOCUMENT_STORAGE_DIR`, mounted as `documents_data` in Compose.

See [Architecture](docs/ARCHITECTURE.md), [Environment](docs/ENVIRONMENT.md), [Operations](docs/OPERATIONS.md), and [Release report](docs/RELEASE_REPORT.md).

## Known limits

- Context retrieval is bounded and lexical. Context Packs are user-curated; other AI flows receive only context the user submits or explicitly attaches.
- Agent runs and steps are persisted, but the API executes them synchronously. There is no queue or background worker. If a non-repeatable step is interrupted, the run blocks for human review.
- Approval records a user decision only. Calendar, email, payments, direct travel booking, action verification, and other external handlers are not connected.
- Travel provider adapters report credentials separately from provider functionality. No live inventory, price revalidation, or booking request is implemented.
- Research source IDs and document citation labels are checked against stored sources/passages; claims are not independently fact-checked. Preview is extracted text only; OCR and embeddings are unavailable.
- Spreadsheet profiling supports CSV/XLSX values, missing values, duplicates, category counts, and basic numeric summaries. Cleaning, transformed-data export, and chart rendering are incomplete.
- Meeting fallback recognizes explicit labels and question lines only. AI writing, explanation, learning, and project-plan drafts require inference credentials; plans remain proposals until users create missions/tasks.
- Playbooks use the existing registered-tool planner and synchronous runner rather than a separate deterministic workflow engine. Briefings are on-demand without schedules or proactive notifications.
- Production hosting, backups, secret management, browser visual QA, and a production storage topology are not configured.

## Local development

Prerequisites: Python 3.12, Node.js 20 with npm, and optional provider credentials. Docker Desktop is needed only for Compose.

```powershell
Copy-Item .env.example .env

# API terminal
cd services/api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH = "."
uvicorn lifeos.main:app --reload --port 8000

# Web terminal
cd apps/web
npm install
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000/api"
npm run dev
```

Open <http://localhost:3000> and register an account. API liveness and readiness are available at `/api/health` and `/api/ready`. Production deployments must run reviewed Alembic migrations and configure durable storage, HTTPS, secrets, and trusted origins.

## Latest local verification

Latest local checks: **50 backend tests passed**; frontend lint, TypeScript check, and production build passed; Alembic upgraded a fresh temporary SQLite database and reported no schema drift. Automated tests use isolated databases or mocked provider responses; they do not prove live credentials, network access, browser microphone behavior, or production readiness. See the [release report](docs/RELEASE_REPORT.md).
