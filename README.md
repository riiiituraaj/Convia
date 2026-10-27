# CONVIA

CONVIA is an authenticated personal continuity workspace for conversations, saved knowledge, research, missions, commitments, risks, and user-reviewed actions. It combines persisted records with a bounded contextual chat and a database-backed, synchronous agent runner. External actions remain unavailable unless a real provider handler is implemented and connected.

## What works

- Account registration, login, signed bearer tokens, and user scoped access to records and activity events.
- Multi-turn conversations with recent history, extracted travel constraints, relevant account-scoped commitments, missions, visible memories, uploaded documents, and saved research. Client request IDs prevent duplicate turns on network retries.
- Mission and commitment capture, review, persistence, and mission graph editing.
- Optional Nebius or NVIDIA OpenAI compatible text inference for supported context and voice response calls.
- Server side Tavily Search with normalized, persisted research sessions and source-linked synthesis. Citation IDs are checked against saved sources; source support is not independently fact checked.
- Persisted agent plans and steps with pause, cancel, resume, approval records, a tool registry, and cautious retry behavior. Runs execute synchronously in the API request; there is no job worker.
- Reusable artifacts for research briefs and proposed plans, with a library, source references, and Markdown/JSON export.
- Travel search forms that generate official provider links. No flight or hotel inventory, price revalidation, or booking is connected.
- User reviewed action proposals. Approval records a decision; it does not run an external operation.
- Private document vault for PDF, DOCX, PPTX, XLSX, TXT, Markdown, and CSV files, with extracted passages and source locators. AI questions and summaries are opt in and send selected passages to the configured provider.
- Document Studio with eight summary modes, extracted-text previews, and cross-document comparison with citation labels checked against retrieved passage references.
- Account-scoped Context Packs that attach only user-selected records, plus an editable Knowledge Vault with provenance-aware notes, collections, tags, and lexical search.
- Studio workflows for explicit-evidence meeting action drafts, user-weighted decision scoring, provider-backed explain/write/learn/project-plan drafts, bounded CSV/XLSX profiling, and an on-demand saved-data briefing.
- Reusable playbooks restricted to registered agent tools; runs hand off to the persisted agent runner and report their actual status and step outcomes.
- Continuity views derived from stored deadlines and commitment state.
- A deterministic demo fixture that is visibly marked and only loads into an empty account.

## Known limits

- Context retrieval is bounded and lexical. Context Packs are user-curated; other AI flows receive only records the user submits or explicitly selects.
- Mission planning groups phrases deterministically and does not infer dependency edges, reliable estimates, or calendar schedules.
- Research citation checks confirm that a reference ID points to a retrieved source. They do not fact-check that source against every generated claim.
- The document vault stores originals on local mounted storage and extracted text in the database. Preview shows extracted text, not page rendering. OCR and embeddings are unavailable. Citation labels are checked against retrieved passages, but claims are not independently fact-checked.
- Agent lifecycle state is persisted, but execution runs in the API request. There is no durable background queue, worker, or automatic recovery after a process crash; an interrupted non-repeatable step is blocked for review.
- Calendar, email, and other external action handlers are not connected. Approval never executes or verifies an action. Travel provider keys alone do not enable live search or booking.
- Spreadsheet profiling supports pasted CSV and uploaded CSV/XLSX values, including missing values, duplicates, category counts, and basic numeric summaries. Cleaning, transformed-data export, and chart rendering remain incomplete.
- Meeting extraction without an inference provider is limited to explicit `Action:`, `TODO:`, `Task:`, `Decision:`, and question lines. Explain, writing, learning, and project-plan drafts require configured inference. Project plans remain proposals until users create real missions/tasks.
- Playbook definitions use the existing tool planner and synchronous agent runner; they are not a separate deterministic workflow engine. Briefings are on-demand snapshots without recurring schedules, notifications, or proactive monitoring.
- Browser speech depends on the browser and network. An explicit NVIDIA Parakeet transcription control is available when the backend key, outbound network, and model access work; server side TTS remains unavailable.
- A configured inference provider is used by supported calls, but the intent planning pipeline is primarily deterministic. Direct provider smoke tests require credentials and are not part of ordinary automated tests.
- Docker Compose is a local development setup bound to `127.0.0.1`, not a production deployment topology.

See [Architecture](docs/ARCHITECTURE.md), [Environment reference](docs/ENVIRONMENT.md), and [Operations](docs/OPERATIONS.md) for details.

## Requirements

- Python 3.12
- Node.js 20 and npm
- Docker Desktop only if using the container setup
- Optional provider credentials for Tavily, Nebius, or NVIDIA

## Local development

From the repository root, copy the example file and edit it if you need provider access:

```powershell
Copy-Item .env.example .env
```

Start the API in one terminal:

```powershell
cd services/api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH = "."
uvicorn lifeos.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
cd apps/web
npm install
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000/api"
npm run dev
```

Open <http://localhost:3000>. API liveness is at <http://localhost:8000/api/health>; database readiness is at <http://localhost:8000/api/ready>. Register an account before using protected workspace routes. Development and test modes create missing tables at startup. Production mode requires an explicit Alembic migration.

## Docker Compose (local only)

Copy `.env.example` to `.env`, set `POSTGRES_PASSWORD` to a long URL safe value (hex is convenient), and set `AUTH_SECRET` to a random value if you want sessions to survive API restarts. Then run:

```powershell
docker compose up --build -d db
docker compose run --rm api alembic upgrade head
docker compose up --build -d
docker compose ps
```

The web app is at <http://localhost:3000> and API at <http://localhost:8000>. The API waits for PostgreSQL health. Compose exposes services only on loopback and uses development mode by default. `NEXT_PUBLIC_API_URL` is embedded at frontend build time; set it to the browser reachable API address before building if that differs from localhost.

## Database migrations

Alembic files live in `services/api/migrations`. From that directory:

```powershell
$env:PYTHONPATH = "."
alembic upgrade head
alembic current
alembic check
```

The initial migration creates the pre-conversation schema; later revisions add conversations, make commitment confidence optional, and add the private document vault. Downgrades intentionally refuse destructive changes. For an existing database created by the earlier development `create_all` path, take and verify a backup, compare its schema with revision `7255d89412d7`, stamp only that matching baseline revision, then run `alembic upgrade head`. If the schema differs, write a reviewed adoption migration. Do not stamp an unmatched schema or point a fresh-schema migration at a data-bearing database.

## Tests and builds

Backend tests use an isolated SQLite database and disable all external providers:

```powershell
cd services/api
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:PYTHONPATH = "."
python -m pytest tests -q
```


## Security notes

- Provider keys stay on the API side; `NEXT_PUBLIC_*` values are public browser configuration.
- Production requires `AUTH_SECRET` with at least 32 characters, a non SQLite database, `LIFEOS_DEBUG=false`, and explicit trusted `CORS_ORIGINS`.
- The API requires an active authenticated account for protected routes. Workspace records and SSE subscriptions are user scoped.
- Demo data is simulation data, does not contact providers, and is refused for accounts that already contain workspace records.

## Product surfaces

The Next.js app contains the landing, login/register, continuity dashboard, conversations, missions, commitments, people, waiting, decisions, risks, agents, activity, memory, documents, library, travel search, search, integrations, and settings pages. Google Workspace can be connected for read-only Gmail, Calendar, and Drive metadata access; see [Google Workspace setup](docs/GOOGLE_WORKSPACE.md). Other unimplemented external actions remain unavailable rather than being presented as connected.

## License

MIT. See [LICENSE](LICENSE).
