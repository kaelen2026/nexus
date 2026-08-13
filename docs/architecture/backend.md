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

Current business dependencies include `LLM -> Billing`. Gateway consumes Auth's public token
verification capability while composing HTTP middleware. Users publishes `users.user-created`;
Billing consumes it to create the free subscription, avoiding a Users/Billing cycle.

## Gateway and Request Context

Gateway is the intended home for request IDs/context, authentication, authorization, rate limiting,
security, error mapping, structured logs, metrics, and tracing. Today it implements request context,
access-token/cookie authentication, trusted-origin enforcement, and CORS. Rate limiting, structured
application logging, metrics, and tracing remain deferred. Gateway has no subscription, quota,
profile, or LLM-routing logic and does not access business data directly.

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

Authentication accepts either an `Authorization: Bearer` access token or the Auth-owned access cookie. Bearer credentials take precedence and remain suitable for non-browser clients. Cookie credentials are subject to trusted-Origin enforcement on non-safe HTTP methods, including refresh requests; invalid credentials and origins use stable, non-disclosing responses. The same allowlist drives credentialed CORS, and every response carries the generated `x-request-id`. Gateway reads Auth protocol details only through `modules/auth/index.ts`.

## Identity, Tokens, and Data Ownership

User is the stable business subject; Account is a login identity; Credential is its proof; Session is a login lifecycle; Identity is the runtime principal. One User may own multiple Accounts.

Auth owns `auth_*`; Users owns `users`, `user_profiles`, and `user_settings`; Billing owns `billing_*`; LLM owns `llm_*`. Shared PostgreSQL does not permit cross-module table access.

Auth uses short-lived JWT access tokens, opaque rotating refresh tokens, and server-side sessions.
Only refresh-token hashes are stored. API keys are a future capability; when introduced, their
plaintext must be returned once and only a hash and safe prefix may persist.

## Billing and LLM

Plan, Subscription, Entitlement, Quota, and Usage are distinct. Product behavior checks entitlements rather than plan names.

```text
Check Entitlement -> Reserve Usage -> Execute -> Commit Actual Usage
                                      failure -> Release Reservation
```

LLM distinguishes Logical Model, Provider Model, Provider, and Channel. Provider schemas remain in `llm/infra/providers`. Streaming emits `start`, `text_delta`, `tool_call_delta`, `usage`, `done`, and `error`; retry/fallback is allowed before the first chunk and disabled by default afterward.

Provider Usage, Billing Usage, and Provider Cost remain distinct. LLM owns provider cost; Billing owns user quota and billable usage.

## Events, Observability, and Verification

Use direct service calls for results and events for facts. The current in-memory bus is synchronous
and non-durable. Consumers should remain idempotent so a future transactional outbox and external
broker can provide at-least-once delivery without changing business effects or contracts.

Correlate structured logs, metrics, traces, audit, and cost by relevant request, correlation, event, LLM request, reservation, session, and user IDs. Never log passwords, OTPs, tokens, API keys, Authorization headers, provider secrets, or full prompts by default.

Architecture conventions cover imports, ownership, and an acyclic graph. Only the bootstrap SDK
boundary currently has an executable architecture test; the broader matrix below remains work to
automate. Integration tests use real PostgreSQL and Redis where persistence semantics matter and
focused fakes for SMS and providers.

The first protected slice is `Phone OTP -> User + Account + Session -> Free Plan -> Access Token -> GET /users/me -> LLM Generate -> Entitlement + Quota -> Provider -> Usage`.

## Detailed Specifications

- [Auth module](../modules/auth.md)
- [Users module](../modules/users.md)
- [Billing module](../modules/billing.md)
- [LLM module](../modules/llm.md)
- [Event contracts](../contracts/events.md)
- [Current implementation status](../project-status.md)
- [First vertical-slice plan](../../.ai/plans/first-vertical-slice.md)

## Shared Code and Package Boundaries

`apps/api/src/shared` is restricted to capabilities without business semantics, initially events, IDs, and time. Business helpers such as `UserUtils`, `BillingHelpers`, or `LLMCommon` belong to their modules.

`packages/*` exists for cross-application technical reuse such as API contracts, database connections, observability, and test utilities. Auth, Users, Billing, and LLM remain modules inside `apps/api`; they are not workspace packages.

## Architecture Verification Matrix

Executable architecture tests should enforce all of the following. As of 2026-08-13, only the
bootstrap restriction against importing the Redis SDK directly is automated:

| Rule | Violation to reject |
| --- | --- |
| Router isolation | Router imports a repo, database client, Redis client, or module infra |
| Service portability | Service imports Hono request/response/context types |
| Public module boundary | A module deep-imports another module instead of its `index.ts` |
| Private adapters | A module imports another module's `repo/*` or `infra/*` |
| Table ownership | A repo imports or queries another module's schema |
| Acyclic graph | Module dependency graph contains a cycle |

## Deferred Architecture

Do not introduce microservices, Kubernetes, a service mesh, Kafka, service discovery, repository interfaces for every repo, broad mapper/DTO layers, or speculative worker infrastructure. The in-memory event bus may evolve to a transactional outbox and external broker only when delivery requirements justify it.
