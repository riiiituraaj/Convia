# Operations

## Start locally

See the root [README](../README.md) for local Python/Node and Docker Compose commands. Compose is local development only and binds its ports to loopback.

## Migrations

From `services/api` with the environment configured:

```powershell
$env:PYTHONPATH = "."
alembic upgrade head
alembic current
alembic check
```

The initial revision creates the pre-conversation schema, followed by revisions for conversation history, optional commitment confidence, and the document vault. Downgrades intentionally refuse destructive changes. For a database created by the earlier `create_all` path, back it up, compare the full schema with revision `7255d89412d7`, stamp that baseline only if it matches, then run `alembic upgrade head`. If it differs, write a reviewed adoption migration. Use a tested database backup and forward migration for rollback. Original document files are stored separately from PostgreSQL in the `documents_data` volume in Compose, so include both the database and that volume in backups.

## Health

- `GET /api/health` is process liveness only.
- `GET /api/ready` checks the database with `SELECT 1` and reports whether provider credentials/configuration are present. It does not make billable calls or verify provider connectivity.
- API response headers include a request ID for basic correlation.

## Provider smoke checks

Ordinary tests force external providers off. If credentials are configured and you authorize a one-request smoke test, verify the selected route with a short prompt and a small Tavily query through the API. These calls may consume provider quota. Do not print or log keys. The final release report should say whether each live check ran and its sanitized outcome. Direct NVIDIA inference is only expected when `AI_PROVIDER=nvidia`; Nebius and NVIDIA keys do not trigger automatic fallback.

## Common failures

| Symptom | Check |
| --- | --- |
| API cannot connect to PostgreSQL | Confirm `POSTGRES_PASSWORD`, the API `DATABASE_URL`, and `docker compose ps` database health |
| Production API starts without tables | Run `alembic upgrade head` using the same `DATABASE_URL` before API startup |
| Protected API returns 401 | Register/log in and ensure the browser includes its bearer token; restart invalidates local tokens if `AUTH_SECRET` is unset |
| Provider reports unavailable | Check `AI_PROVIDER`, the matching server-only key, model identifier, and provider account entitlement |
| Search returns no sources | Check `TAVILY_API_KEY`; unavailable responses intentionally contain no fixture results |
| Browser cannot reach API in Docker | Set `NEXT_PUBLIC_API_URL` to the browser reachable host before building the web image; container DNS names are not browser addresses |
| CORS blocks a deployed browser | Set `CORS_ORIGINS` to the exact frontend origin, including scheme and port |

## Release and deploy

1. Review `docs/RELEASE_CHECKLIST.md` and the actual `docs/RELEASE_REPORT.md` results.
2. Run backend tests, frontend lint/typecheck/build, migration checks, and any credentialed smoke tests separately.
3. Back up the target database and apply a reviewed migration.
4. Configure HTTPS, exact CORS origins, secret storage, database backups, and browser reachable API URL on the selected hosting target.
5. Deploy the API and web app using the target's supported streaming and timeout behavior.
6. Check `/api/health`, `/api/ready`, account registration/login, ownership boundaries, and one non-billable protected route.

No cloud hosting target or deployment credentials are configured in this repository, so deployment instructions remain target neutral. Do not interpret a local Compose run as a public deployment.
