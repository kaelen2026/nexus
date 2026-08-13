# Project Status

This page records the repository state reviewed on 2026-08-13. It distinguishes behavior present in
source and tests from target architecture described elsewhere.

## Implemented vertical slice

| Capability | Implementation | Verification |
| --- | --- | --- |
| Phone OTP | Normalization, hashed Redis challenge, atomic consumption, injectable SMS seam | Auth service, crypto, Redis, and HTTP tests |
| Identity and sessions | User + phone Account creation, JWT access token, rotating opaque refresh token, reuse revocation, logout and logout-all | PostgreSQL integration and HTTP tests |
| Browser auth | HttpOnly cookie mode, trusted-origin checks, credentialed CORS, shared refresh and one retry | Gateway and web client/component tests |
| Current user | Authenticated `GET /users/me` backed by Users storage | HTTP and web component tests |
| Free access | Idempotent `users.user-created` consumer, free entitlement, 10,000-token quota | Billing integration tests |
| Usage accounting | Transactional reserve/commit/release with per-user advisory locking | Billing integration tests |
| LLM generation | `standard` logical model, entitlement/quota checks, provider seam, normalized response | Service and HTTP tests |
| LLM requests | Durable processing/succeeded/failed lifecycle without prompt or provider-error persistence | PostgreSQL integration tests |
| Web workspace | Prompt entry, output limit, generation result, token usage, copy, stable error states | Vitest + Testing Library |
| HTTP observability | Correlated structured logs, W3C trace propagation, server spans, Prometheus request metrics | Gateway tests |

PostgreSQL schemas and eleven committed migrations exist for Users, Auth, Billing, and LLM. Redis is
used only for short-lived OTP challenges. The event bus is synchronous and in-memory;
`users.user-created` has a Users-owned transactional outbox with startup replay, and Billing's
consumer protects its durable effect with event receipts and database uniqueness.

## Runtime gap

`createApiRuntime` composes the database, migrations, Redis-backed Auth, event bus, Users, Billing,
LLM, and all HTTP routers. It requires concrete `SmsSender` and `LlmProvider` dependencies.

The executable `apps/api/src/server.ts` does not call that composition root yet. It creates the bare
Hono app, so `pnpm --filter @nexus/api dev` currently serves only `GET /health`. Consequently the Web
login and generation screens cannot complete their flows against the default development server.
This is a runtime integration gap, not a missing domain-service implementation.

The next cohesive increment should add real provider adapters and a server composition path, with
configuration validation and shutdown handling, before documenting the full stack as locally
runnable.

## Deliberately deferred

- Streaming generation, channel selection/fallback, provider pricing, and provider-cost accounting.
- Password, API-key, and account-linking workflows.
- Payment-provider integration and paid-plan management.
- A generic outbox or external event broker beyond the current Users-owned outbox.
- Rate limiting.
- The full architecture rule suite. The current architecture test only guards bootstrap from a
  direct Redis SDK import; the remaining boundary rules are conventions awaiting executable tests.

These are not prerequisites for preserving the current module boundaries, and should be added only
when the vertical slice needs them.
