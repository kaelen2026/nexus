# Backend Architecture — Pragmatic Modular Monolith

## Decision

Nexus uses a pnpm/Turborepo monorepo, TypeScript, Hono, PostgreSQL/Drizzle, Redis, Zod, and Vitest. `apps/api` is a modular monolith.

> Monorepo manages application boundaries; modules manage business boundaries. Inside a module, use `router -> service -> repo`; put external adapters in `infra`.

The design is MVP-first, keeps boundaries executable, avoids speculative abstraction, and preserves a path to extract workers or services. It does not currently adopt microservices, Kubernetes, service mesh, Kafka, service discovery, complex DDD layers, repository interfaces for everything, or broad DTO/mapper layers.

## Repository and Module Shape

Applications live in `apps/*`; cross-app technical packages live in `packages/*`; backend business modules stay inside `apps/api/src/modules/*` rather than becoming workspace packages. The intended modules are Auth, Users, Billing, and LLM.

A module may contain `router/`, `service/`, `repo/`, `infra/`, `types.ts`, `errors.ts`, and `index.ts`, but only when needed. `index.ts` is its sole public API.

The enforceable rules are:

1. Request flow is `router -> service -> repo`.
2. Services do not depend on Hono.
3. Cross-module calls use capabilities exported from the target `index.ts`.
4. Cross-module access to `repo` and `infra` is forbidden.
5. Repos access only their module's tables.
6. The module graph is acyclic.

Initial dependencies are `Gateway -> Auth` and `LLM -> Billing`. Users publishes `users.user-created`; Billing consumes it to create the free subscription, avoiding a Users/Billing cycle.

## Gateway and Request Context

Gateway owns request IDs/context, authentication, authorization, rate limiting, security, error mapping, structured logs, metrics, and tracing. It has no subscription, quota, profile, or LLM-routing logic and does not access business data directly.

```ts
interface RequestContext {
  requestId: string
  identity: {
    type: 'user' | 'api_key' | 'service'
    subject: string
    accountId?: string
    roles: string[]
    scopes: string[]
  } | null
  client: { ip?: string; userAgent?: string }
  startedAt: number
}
```

For user identities, `identity.subject` is the stable `userId`.

## Identity, Tokens, and Data Ownership

User is the stable business subject; Account is a login identity; Credential is its proof; Session is a login lifecycle; Identity is the runtime principal. One User may own multiple Accounts.

Auth owns `auth_*`; Users owns `users`, `user_profiles`, and `user_settings`; Billing owns `billing_*`; LLM owns `llm_*`. Shared PostgreSQL does not permit cross-module table access.

Auth uses short-lived JWT access tokens, opaque rotating refresh tokens, and server-side sessions. Only refresh-token hashes are stored. API-key plaintext is returned once; only its hash and prefix persist.

## Billing and LLM

Plan, Subscription, Entitlement, Quota, and Usage are distinct. Product behavior checks entitlements rather than plan names.

```text
Check Entitlement -> Reserve Usage -> Execute -> Commit Actual Usage
                                      failure -> Release Reservation
```

LLM distinguishes Logical Model, Provider Model, Provider, and Channel. Provider schemas remain in `llm/infra/providers`. Streaming emits `start`, `text_delta`, `tool_call_delta`, `usage`, `done`, and `error`; retry/fallback is allowed before the first chunk and disabled by default afterward.

Provider Usage, Billing Usage, and Provider Cost remain distinct. LLM owns provider cost; Billing owns user quota and billable usage.

## Events, Observability, and Verification

Use direct service calls for results and events for facts. Start with an in-memory bus; assume at-least-once delivery and idempotent consumers. Important state events can later use a transactional outbox without changing contracts.

Correlate structured logs, metrics, traces, audit, and cost by relevant request, correlation, event, LLM request, reservation, session, and user IDs. Never log passwords, OTPs, tokens, API keys, Authorization headers, provider secrets, or full prompts by default.

Architecture tests enforce imports, ownership, and an acyclic graph. Integration tests prefer real PostgreSQL and Redis and focused fakes for SMS, providers, time, and IDs.

The first protected slice is `Phone OTP -> User + Account + Session -> Free Plan -> Access Token -> GET /users/me -> LLM Generate -> Entitlement + Quota -> Provider -> Usage`.
