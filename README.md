# Nexus

Nexus is a TypeScript monorepo for an authenticated LLM product. It currently contains a Hono
modular-monolith API, a Next.js web application, and a shared PostgreSQL/Drizzle package.

The implemented vertical slice covers phone OTP authentication, cookie and Bearer sessions,
current-user lookup, free-plan assignment, entitlement and quota enforcement, non-streaming LLM
generation, durable request records, and normalized usage accounting. The browser UI supports OTP
login, session revocation, and the authenticated generation workspace.

## Repository

```text
apps/api                 Hono API and business modules
apps/web                 Next.js browser application
packages/database        PostgreSQL connection and migration runner
docs/                     Architecture, module, contract, and development documentation
```

The API follows `router -> service -> repo`. Business modules live in
`apps/api/src/modules/{auth,users,billing,llm}`, and cross-module calls go through each module's
`index.ts`.

## Current status

The domain flow is implemented and exercised through unit, HTTP, module integration, and web
component tests. In development, the default API entry point composes the complete local runtime
with in-memory SMS/email inboxes and a deterministic LLM provider. Production provider selection
and deployment composition remain deferred.

See [project status](docs/project-status.md) for the implementation matrix and known gaps.

## Development

Prerequisites are Node.js 24, pnpm 10.14, and Docker with Compose.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm docker:up
pnpm db:migrate
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

For service URLs, environment handling, focused test commands, and the current runtime limitation,
read [local development](docs/local-development.md).

## Documentation

- [Backend architecture](docs/architecture/backend.md)
- [Testing strategy](docs/architecture/testing.md)
- [Auth](docs/modules/auth.md), [Users](docs/modules/users.md),
  [Billing](docs/modules/billing.md), and [LLM](docs/modules/llm.md)
- [Business event contracts](docs/contracts/events.md)
