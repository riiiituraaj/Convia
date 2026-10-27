# Environment reference

Values in `.env.example` are placeholders. Never commit `.env` or provider keys. The API reads the repository root `.env` during local development and otherwise reads process environment variables. Docker Compose reads root `.env` for interpolation and passes backend variables into the API container. `NEXT_PUBLIC_API_URL` is public and is embedded into the frontend build.

| Variable | Purpose / consumer | Required | Secret | Safe value or notes |
| --- | --- | --- | --- | --- |
| `APP_ENV` | API mode: `development`, `test`, `production` | No | No | `development`; production disables automatic table creation |
| `LIFEOS_DEBUG` | API debug mode | No | No | `false`; must be false in production |
| `DATABASE_URL` | SQLAlchemy async database URL used by API and Alembic | No | Sometimes | `sqlite+aiosqlite:///./convia.db` locally; production needs durable PostgreSQL with `asyncpg` |
| `POSTGRES_PASSWORD` | Compose PostgreSQL container and API DB URL | Compose only | Yes | Replace with long URL safe random text; hex is convenient |
| `AUTH_SECRET` | API JWT signing key | Production | Yes | At least 32 random characters; optional in development, but a local random key invalidates sessions on restart |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | API bearer token lifetime | No | No | `1440`; 5 to 43200 |
| `CORS_ORIGINS` | API trusted browser origins | Production | No | JSON list, e.g. `["https://app.example.com"]`; no wildcard in production |
| `AI_PROVIDER` | API inference route | No | No | `disabled`, `nebius`, or `nvidia`; no key-based fallback |
| `AI_REQUEST_TIMEOUT_SECONDS` | API inference timeout | No | No | `45`, bounded from 1 to 180 |
| `AI_MAX_RETRIES` | API retry count for transient inference errors | No | No | `1`, bounded from 0 to 3 |
| `NEBIUS_API_KEY` | Nebius inference authentication | When selected | Yes | Obtain from the Nebius Token Factory account |
| `NEBIUS_BASE_URL` | Nebius API base URL | No | No | `https://api.tokenfactory.nebius.com/v1`; verify account access |
| `NEBIUS_NEMOTRON_MODEL` | Nebius default model identifier | When selected | No | Blank by default; set a model available to your account |
| `NEBIUS_FAST_MODEL` | Optional model used for simple tasks | No | No | Blank falls back to the configured default model |
| `NEBIUS_REASONING_MODEL` | Optional model used for complex tasks | No | No | Blank falls back to the configured default model |
| `NVIDIA_API_KEY` | NVIDIA NIM inference authentication; also used for explicit opt-in Parakeet transcription | When NVIDIA is selected or server ASR is used | Yes | Obtain from the NVIDIA NIM account and enable access to the ASR endpoint |
| `NVIDIA_NIM_BASE_URL` | NVIDIA NIM API base URL | No | No | `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_NIM_MODEL` | NVIDIA default model identifier | When selected | No | Blank by default; set a model available to your account |
| `NVIDIA_NIM_FAST_MODEL` | Optional model used for simple tasks | No | No | Blank falls back to the configured default model |
| `NVIDIA_NIM_REASONING_MODEL` | Optional model used for complex tasks | No | No | Blank falls back to the configured default model |
| `TAVILY_API_KEY` | Backend Tavily Search authentication | Optional | Yes | Omit for explicit unavailable state; never put in frontend variables |
| `TAVILY_TIMEOUT_SECONDS` | API Tavily request timeout | No | No | `20`, bounded from 1 to 60 |
| `TAVILY_MAX_RESULTS` | Maximum normalized source count | No | No | `5`, bounded from 1 to 10 |
| `DOCUMENT_STORAGE_DIR` | API directory for private original document uploads | No | No | `local_data/documents`; mount persistent private storage for deployments |
| `DOCUMENT_MAX_UPLOAD_BYTES` | Maximum size per document upload | No | No | `15728640` (15 MiB), bounded from 1 KiB to 50 MiB |
| `DOCUMENT_MAX_USER_BYTES` | Total original file storage allowed per account | No | No | `262144000` (250 MiB), bounded from 1 MiB to 10 GiB |
| `DOCUMENT_MAX_USER_FILES` | Maximum original files allowed per account | No | No | `100`, bounded from 1 to 10000 |
| `NEXT_PUBLIC_API_URL` | Browser API base URL used at frontend build time | Yes for non-default host | No | `http://localhost:8000/api` locally; public browser configuration only |

## Provider notes

Nebius documents an OpenAI compatible inference API at `https://api.tokenfactory.nebius.com/v1`; see [Nebius Token Factory API docs](https://api.tokenfactory.nebius.com/docs). NVIDIA documents its NIM OpenAI compatible LLM endpoints at `https://integrate.api.nvidia.com/v1`; see [NVIDIA NIM LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis). Model availability depends on account access, so CONVIA intentionally leaves model IDs blank rather than assuming an example model is available.

The optional server transcription flow sends a user-selected recording through the authenticated API to NVIDIA Parakeet's `/v1/audio/transcriptions` endpoint. It requires API-side internet access and NVIDIA ASR model entitlement; a configured key alone does not verify connectivity. Server-side text-to-speech is not configured.

Tavily Search uses the server-side `/search` endpoint with bearer authentication; see [Tavily Search API](https://help.tavily.com/articles/4840311948-tavily-search-api). Search is unavailable when `TAVILY_API_KEY` is absent.

Document originals are stored under `DOCUMENT_STORAGE_DIR`; extracted text and source locators are stored in the selected database. Compose mounts a separate `documents_data` volume. Do not place this directory on a public web root. Upload-time extraction runs locally; only explicit Ask and Summarize actions send selected extracted passages to the configured inference provider.

## Production validation

Set `APP_ENV=production`, a strong `AUTH_SECRET`, PostgreSQL `DATABASE_URL`, `LIFEOS_DEBUG=false`, and the exact trusted frontend origin in `CORS_ORIGINS`. Run Alembic before starting the API. Keep provider keys in the deployment platform's secret store and set `NEXT_PUBLIC_API_URL` to the address the user's browser can reach.
