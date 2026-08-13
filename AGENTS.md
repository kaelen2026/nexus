# Repository Instructions

## Architecture

This repository uses a pnpm/Turborepo monorepo, TypeScript, Hono, and a pragmatic modular monolith. The backend lives in `apps/api`; business modules live in `apps/api/src/modules/*`.

> Monorepo manages application boundaries; modules manage business boundaries. Inside a module, the normal flow is `router -> service -> repo`, with external adapters in `infra`.

Prefer the smallest implementation that preserves module boundaries. Do not add layers, interfaces, directories, or infrastructure without a current need.

## Git Workflow

Never develop directly on `main`. Every change uses a short-lived branch and a Pull Request:

1. Update local `main` from `origin/main`.
2. Create a branch such as `feat/<topic>`, `fix/<topic>`, `test/<topic>`, or `chore/<topic>`.
3. Work in small Red/Green/Refactor commits using Conventional Commits.
4. Push the branch and open a Pull Request against `main`.
5. Merge only after required CI checks pass and review requirements are satisfied.

Keep PRs focused on one behavior or cohesive vertical-slice increment. Do not mix unrelated refactors. Prefer squash merge so `main` retains one Conventional Commit per PR, and delete the source branch after merge.

## Module Structure

The optional default shape is `router/`, `service/`, `repo/`, `infra/`, `types.ts`, `errors.ts`, and `index.ts`. Never create empty architecture solely for symmetry.

## Core Rules

1. Normal request flow is `router -> service -> repo`.
2. Services use plain TypeScript inputs and outputs and must not depend on Hono.
3. A module may call a service capability exported by another module.
4. Every cross-module import must use the target module's `index.ts`.
5. Never import another module's `repo/*` or `infra/*`.
6. A repo may access only tables owned by its module.
7. Module dependencies must form a directed acyclic graph.

`index.ts` is the only module public API. Export only capabilities genuinely needed by other modules.

## Responsibilities

- Router owns Hono, HTTP inputs, Zod validation, status codes, and response mapping. It contains no business workflow and does not access PostgreSQL or Redis.
- Service owns use cases, rules, coordination, repo calls, cross-module calls, and event publishing. Prefer small use-case files over giant `*.service.ts` files.
- Repo owns persistence and may use Drizzle directly. Add an interface only for a real second implementation or concrete testing need.
- Infra owns Redis, SMS, JWT, password hashing, external APIs, provider SDKs, pricing configuration, and secrets.
- Gateway owns request context/IDs, authn/authz, rate limiting, security, structured logging, error mapping, metrics, and tracing—not business workflows.

## Identity and Ownership

`User` is the stable business subject; `Account` is an authentication identity; `Credential` is authentication proof; `Session` is a login lifecycle; `Identity` is the runtime principal. The relationship is `User 1:N Account`, and `Identity.subject = userId`.

- Auth owns `auth_*`.
- Users owns `users`, `user_profiles`, and `user_settings`.
- Billing owns `billing_*`.
- LLM owns `llm_*`.

Sharing PostgreSQL does not imply shared ownership. Never query another module's tables directly.

## Billing, LLM, and Events

Do not branch product behavior on plan names. Use Entitlement, Quota, and Usage. Expensive operations support `reserve -> execute -> commit`, with `release` on failure.

LLM flow is `Resolve Model -> Check Entitlement -> Reserve Usage -> Select Channel -> Provider Adapter -> Normalize Usage -> Commit Usage`. Provider SDKs and schemas stay in `modules/llm/infra/providers`.

Use direct service calls when a caller needs a result. Use events for facts that already happened. Assume at-least-once delivery and require idempotent consumers.

## Testing

Architecture tests verify: services do not import Hono; routers do not access databases; cross-module deep imports are forbidden; repos do not access foreign schemas; and the module graph has no cycles. Prefer real PostgreSQL and Redis in meaningful integration tests, with focused fakes for SMS, providers, clocks, and IDs.

Development follows test-driven development:

1. Red: write the smallest failing test that describes the next observable behavior.
2. Green: implement only enough production code to make it pass.
3. Refactor: improve the design while keeping all tests green.

For bug fixes, reproduce the bug with a failing test before changing production code. Test behavior through a module's public API or HTTP boundary; do not couple tests to private implementation details. Unit tests are appropriate for pure business rules, integration tests for modules with real PostgreSQL/Redis, and critical-flow tests for cross-module behavior. Do not mock Drizzle query chains or Hono internals.

Every implementation task must identify its current Red/Green/Refactor state. A change is not complete until relevant tests, typechecking, formatting/linting, and the build pass.

## Current Vertical Slice

Prioritize: `Phone OTP -> User -> Account -> Session -> Free Plan -> Access Token -> GET /users/me -> LLM Generate -> Entitlement / Quota -> Provider -> Usage`.

Do not add unrelated platform infrastructure before this slice requires it.
