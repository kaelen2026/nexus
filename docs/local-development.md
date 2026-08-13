# Local Development

## Prerequisites

- Node.js 24 (the version used by CI)
- pnpm 10.14
- Docker with Compose

Install the workspace and create the root environment file:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

PostgreSQL and Redis run in Docker Compose. Copy `.env.example` to `.env` only when overriding the safe local defaults.

```bash
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker:up` waits until both health checks pass. PostgreSQL listens on `localhost:5432` and Redis on `localhost:6379` by default.

Apply committed Drizzle migrations after the services are healthy:

```bash
pnpm db:migrate
```

Start the API and web app with `pnpm dev`. The API development server binds only to
`127.0.0.1:3000` and refuses to use its local adapters unless `NODE_ENV=development`.

The local SMS adapter keeps OTPs in memory instead of sending a real text message. After requesting
an OTP, read the latest message for that phone number with:

```bash
curl 'http://127.0.0.1:3000/dev/sms/latest?phoneNumber=%2B8613800138000'
```

The response is marked `Cache-Control: no-store`. Restarting the API clears the inbox. The local LLM
adapter returns a deterministic response prefixed with `Local response:` so the complete login and
generation flow works without external credentials.

After changing a module-owned Drizzle schema, generate and review a migration with `pnpm db:generate`. Schema source files stay in their owning modules; generated migration artifacts live in `packages/database/migrations`.

Data persists in the named volumes `nexus_postgres-data` and `nexus_redis-data`. `pnpm docker:down` stops and removes containers but preserves data. Removing volumes is intentionally not exposed as a package script because it deletes local database state.

Default local URLs:

```text
postgresql://nexus:nexus@localhost:5432/nexus
redis://localhost:6379
```

## Running applications

The web application can be started at `http://localhost:3001`:

```bash
pnpm --filter @nexus/web dev
```

Next.js reads public browser configuration from `apps/web/.env.local` (or from the command
environment), not the repository-root `.env` used by Docker Compose. The default API origin is
already `http://localhost:3000`; override it when needed by creating `apps/web/.env.local` with:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Google and Apple authentication

OAuth providers are enabled only when their complete environment-variable group is present. Set
`APP_PUBLIC_URL` to the web origin and `API_PUBLIC_URL` to the externally reachable API origin.

For Google, register `${API_PUBLIC_URL}/auth/oauth/google/callback` as an authorized redirect URI,
then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

For Apple, register `${API_PUBLIC_URL}/auth/oauth/apple/callback` as the Services ID return URL,
then set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY`. Apple requires
an HTTPS return URL with a domain name, so its flow cannot use `localhost`; use an HTTPS development
domain or tunnel. A multiline private key may be supplied with literal `\\n` separators.

The API development command starts `apps/api/src/server.ts` on `http://localhost:3000`:

```bash
pnpm --filter @nexus/api dev
curl http://localhost:3000/health
```

At present that entry point mounts only `GET /health`. The full composition function
`createApiRuntime` exists and wires Auth, Users, Billing, LLM, PostgreSQL, Redis, migrations, and
routers, but it requires concrete production `SmsSender` and `LlmProvider` adapters that have not
been selected. Do not expect browser login or generation to work against the default API process
until that runtime integration is completed.

## Verification

The full CI-equivalent sequence is:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Focused loops are available with `pnpm --filter @nexus/api test:watch` and
`pnpm --filter @nexus/web test`. API integration tests require healthy PostgreSQL and Redis; Web
tests do not.

API integration test files currently run serially because they share the local PostgreSQL database and Redis instance. This avoids cross-file `TRUNCATE` and key-lifecycle races. Parallel execution should be enabled only after provisioning an isolated database/schema and Redis namespace per worker.
