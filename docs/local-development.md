# Local Development

PostgreSQL and Redis run in Docker Compose. Copy `.env.example` to `.env` only when overriding the safe local defaults.

```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker:up` waits until both health checks pass. PostgreSQL listens on `localhost:5432` and Redis on `localhost:6379` by default.

Data persists in the named volumes `nexus_postgres-data` and `nexus_redis-data`. `pnpm docker:down` stops and removes containers but preserves data. Removing volumes is intentionally not exposed as a package script because it deletes local database state.

Default local URLs:

```text
postgresql://nexus:nexus@localhost:5432/nexus
redis://localhost:6379
```
