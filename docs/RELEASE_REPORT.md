# Release report

## Implemented in this checkout

- Account-scoped conversations with multi-turn history, extracted constraints, selected relevant memories/missions/commitments/documents/research, and client request IDs for retry deduplication.
- Durable database records for research sessions, source metadata, artifacts, agent runs, and ordered agent steps.
- Tavily-backed search when configured; saved research can be reopened, converted to a brief or mission, and cited by source IDs. Citation IDs are checked against saved sources; factual support is not independently verified.
- Private document upload, bounded extraction, lexical passage search, opt-in AI Q&A/summaries, download, and deletion.
- An agent tool registry for read-only research/document search, mission/task creation, artifact saving, and approval recording. Repeated writes are not automatically retried; uncertain interrupted writes block for user inspection.
- A Library view for saved artifacts and a Travel Search view for official flight/hotel links without fabricated inventory or prices.
- An account-scoped Studio and Knowledge workspace with editable Context Packs, provenance-aware notes, and reusable playbooks restricted to registered agent tools.
- Eight document summary modes, extracted-text preview, and comparison of up to five documents with passage-label validation.
- Meeting action drafts with verbatim evidence checks, deterministic weighted decision scoring, provider-backed explanation/writing/learning/project-plan drafts, bounded CSV/XLSX profiling, and an on-demand data-backed personal briefing.
- Browser voice plus opt-in NVIDIA Parakeet upload transcription when the user starts the recording action.
- Authentication and account ownership checks, forward Alembic migrations, and local Compose storage for document originals.

## Verification

Isolated test databases and a temporary migration database were used; the configured workspace database was not a migration target.

- Backend: **53 pytest tests passed**. Test configuration used an isolated SQLite database and disabled paid providers; selected paths use mocked provider responses.
- Frontend: **lint, TypeScript typecheck, and optimized production build passed**. Build includes `/library`, `/travel`, and `/studio`.
- Database: **fresh Alembic upgrade and `alembic check` passed** through `a82ce1d94f21`; no schema drift was detected.
- Provider credentials and live requests: not exercised in local automated checks.
- Docker and browser/microphone visual QA: not exercised.

## Product limits and release risks

- Agent execution is synchronous in the API request. Persisted lifecycle controls do not provide a background queue, worker, or automatic recovery/reconciliation after a process crash.
- Approval records do not execute or verify external actions. Calendar, email, payments, and direct travel booking are not connected.
- Travel provider adapters do not call live inventory APIs even if credentials exist; only official search links are available.
- Context retrieval remains bounded and lexical. Context Packs are explicit user-selected bundles; other model calls do not get all saved context automatically.
- Research source IDs and document citation labels are checked against stored sources/passages; claims are not independently fact-checked. Document preview shows extracted text only; OCR and embeddings are unavailable.
- Spreadsheet support profiles CSV/XLSX values but does not clean/export transformed data or render charts. Meeting extraction without AI is limited to explicit action/decision labels and questions.
- Explain, writing, learning, and project-plan drafting require inference credentials. Project plans are drafts until a user converts them to mission/task records. Playbooks use the existing synchronous agent planner.
- Personal briefings are on-demand; scheduling and proactive notifications are unavailable. Travel still has no live inventory, revalidation, or booking.
- No production hosting, DNS, HTTPS endpoint, backup policy, or production database has been configured.

## Security and deployment notes

- Protected workspace resources are scoped to the authenticated account; provider keys remain server side.
- Production validation requires a strong `AUTH_SECRET`, durable database, trusted CORS origins, and debug disabled.
- The frontend stores bearer tokens in browser local storage. Use HTTPS and an appropriate browser security policy in a deployment.
- Review and back up any existing database before applying migrations. Automated migration validation uses an isolated temporary database.
