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

PostgreSQL schemas and ten committed migrations exist for Users, Auth, Billing, and LLM. Redis is
used only for short-lived OTP challenges. The event bus is synchronous and in-memory; Billing's
consumer protects its durable effect with event receipts and database uniqueness.

## Runtime composition

`createApiRuntime` composes the database, migrations, Redis-backed Auth, event bus, Users, Billing,
LLM, and all HTTP routers. The executable development server supplies local SMS, email, and LLM
adapters, validates its environment, and closes owned resources during shutdown. The complete Web
login and generation flow is locally runnable. Concrete production providers and a production
deployment entry point remain deferred.

## Deliberately deferred

- Streaming generation, channel selection/fallback, provider pricing, and provider-cost accounting.
- Password, API-key, account-linking, profile, and settings workflows.
- Payment-provider integration and paid-plan management.
- Transactional outbox or external event broker.
- Rate limiting, structured application logging, metrics, and tracing.
- Additional architecture rules beyond the current service, router, module-public-API, repository
  ownership, dependency-cycle, and bootstrap SDK checks.

These are not prerequisites for preserving the current module boundaries, and should be added only
when the vertical slice needs them.
