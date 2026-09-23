# CONVIA

**Personal Continuity Engine — Never drop the thread.**

CONVIA watches your commitments, protects what matters, and closes important loops before they slip. Built around a single core primitive: the **Commitment**.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, TanStack Query |
| Backend | FastAPI, SQLAlchemy (async), Pydantic, SQLite (dev) / PostgreSQL (prod) |
| Intelligence | NVIDIA Nemotron (Nebius Token Factory / NVIDIA NIM) |
| Speech | Browser Web Speech (live) · NVIDIA Parakeet ASR/TTS endpoints (Coming Soon wiring) |
| Research | Tavily |

## Quick start (local)

### 1. Backend

```powershell
cd services/api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH="."
uvicorn lifeos.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/health

### 2. Frontend

```powershell
cd apps/web
npm install
$env:NEXT_PUBLIC_API_URL="http://localhost:8000/api"
npm run dev
```

App: http://localhost:3000

### 3. Environment

Copy `.env.example` to `.env` and fill in keys:

- `NEBIUS_API_KEY` / `NVIDIA_API_KEY` — Nemotron reasoning + speech
- `TAVILY_API_KEY` — live web research
- `AUTH_SECRET` — JWT signing secret (change in production)

Without API keys, CONVIA falls back to deterministic local responses (no fake LLM output).

## Docker

```powershell
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8000

## Tests

```powershell
cd services/api
$env:PYTHONPATH="."
python -m pytest tests -q
```

Frontend checks:

```powershell
cd apps/web
npm run lint
npm run typecheck
npm run build
```

## Product surfaces

| Route | Purpose |
| --- | --- |
| `/` | Product landing |
| `/login` · `/register` | Session |
| `/life` | Continuity dashboard (score, blind spots, resolve day) |
| `/missions` | Missions & graphs |
| `/commitments` | Commitment lifecycle |
| `/people` | Relationship profiles from commitments |
| `/waiting` | Bidirectional waiting state |
| `/decisions` | Action Passport approval layer |
| `/risks` | Risk detection & recovery |
| `/agents` | Multi-agent center |
| `/activity` | Agent run telemetry (SSE live) |
| `/memory` | Structured memory |
| `/search` | Cross-entity search + web research |
| `/integrations` | Honest integration status |
| `/settings` | Autonomy, voice, appearance, profile |

## Core principles

1. **Commitment is the primitive.** Everything derives from it.
2. **Never fake functionality.** Unimplemented features show "Coming Soon".
3. **Human approval layer.** Meaningful actions create Action Passports.
4. **Honest integrations.** Nothing shows as connected without credentials.

## License

MIT — see [LICENSE](./LICENSE).
