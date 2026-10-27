# Controlled release checklist

## Verified locally in this workspace

- [x] Backend suite: 50 tests passed using an isolated SQLite database and disabled or mocked providers.
- [x] Frontend lint passes.
- [x] Frontend TypeScript check passes.
- [x] Optimized frontend production build passes, including `/library` and `/travel`.
- [x] Fresh Alembic upgrade and `alembic check` pass on a temporary SQLite database.
- [ ] Docker Compose configuration and image build checked (Docker unavailable/not run).
- [x] Authenticated API journeys and cross-account ownership tests pass.

## Before a controlled public release

- [ ] Configure production `AUTH_SECRET`, durable PostgreSQL, exact `CORS_ORIGINS`, and `LIFEOS_DEBUG=false`.
- [ ] Back up and review any existing database before migration or stamp.
- [ ] Verify the selected inference model is enabled for the account; run a credentialed smoke request.
- [ ] Run a credentialed Tavily Search smoke request if research will be offered.
- [ ] Configure HTTPS, secret management, database backups, reverse proxy, and a browser-reachable API URL.
- [ ] Decide whether synchronous agent execution, absent external action handlers, lexical-only retrieval, and incomplete product workflows block release.
- [ ] Perform visual browser QA on desktop and mobile using the target deployment.
- [ ] Review retention, privacy notice, accessibility, and operational monitoring for the intended release audience.

Automated checks passing does not make the product production-ready. The release report lists the current functional boundaries and external integrations that remain unavailable.
