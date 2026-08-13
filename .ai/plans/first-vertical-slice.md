# First Vertical Slice Implementation Plan

## Objective

Deliver and protect the first complete business path:

```text
Phone OTP -> User -> Account -> Session -> Free Plan -> Access Token
          -> GET /users/me -> LLM Generate -> Entitlement / Quota
          -> Provider -> Usage
```

Each increment uses a short-lived branch, a focused PR, and an explicit Red/Green/Refactor record. Status values are `done`, `in progress`, `next`, `pending`, or `deferred`.

## Current Status

| Increment | Status | Evidence |
| --- | --- | --- |
| Monorepo, Hono API, quality gates, CI | done | Initial commits and CI workflow |
| Docker PostgreSQL and Redis | done | PR #2 |
| Drizzle/PostgreSQL connection foundation | done | PR #3 |
| Send OTP service behavior | done | PR #4 |
| Redis OTP challenge store and TTL | done | PR #5 |
| Preserve full architecture and execution plan | done | PR #6 |
| `POST /auth/otp/send` HTTP behavior | in progress | Current feature PR |
| Production Auth dependency composition | next | Not started |

Update this table in every vertical-slice PR that changes scope or status.

## Phase 1 — Send OTP Endpoint

1. Red: HTTP test for `POST /auth/otp/send` validates and normalizes the phone number, returns expiry, and never returns the OTP.
2. Green: Add Auth router/schema and bootstrap composition using the existing service and Redis store.
3. Red: invalid phone input maps to a stable 400 error response.
4. Refactor: centralize only the gateway error/context pieces demanded by the tests.

Completion: endpoint is reachable, Redis TTL is real, SMS uses a deterministic fake in tests, and logs contain no OTP.

## Phase 2 — Verify OTP and Identity Persistence

1. Red: a valid OTP can be consumed only once.
2. Add Auth-owned schema/migration for `auth_accounts` and `auth_sessions`.
3. Add Users-owned schema/migration for `users`.
4. Red: first verification atomically creates User, Account binding, and Session.
5. Red: repeated login reuses the same User and Account but creates the intended Session lifecycle.
6. Red: invalid, expired, or consumed OTP is rejected.
7. Red: one external Account cannot bind to multiple Users.

Migration and schema files remain with their owning API modules. The database package provides connections and migration mechanics but does not own business tables.

Completion: integration tests use real PostgreSQL and Redis, uniqueness is enforced by database constraints, and partial identity state cannot commit.

## Phase 3 — Tokens and Authentication Gateway

1. Red: verification returns a short-lived JWT access token and opaque refresh token.
2. Persist only refresh-token hashes tied to a server-side Session.
3. Red: refresh rotates tokens; reuse revokes the token family/session.
4. Red: logout revokes the current Session; logout-all revokes every User Session.
5. Red: authentication produces `Identity.subject = userId`.

Completion: secrets are never logged or persisted in plaintext, and gateway authentication is independent of business routers.

## Phase 4 — Current User

1. Red: authenticated `GET /users/me` returns the stable User identity.
2. Red: suspended/deleted User status maps to the defined authorization behavior.
3. Verify Auth Account status and User status remain independent.

Completion: Users is accessed through `users/index.ts`, and routers do not access repos directly.

## Phase 5 — Free Plan via Event

1. Add the minimal in-memory event bus only when User creation needs it.
2. Publish `users.user-created` after durable creation.
3. Add minimal Billing schemas for plans, subscriptions, entitlements, and consumer idempotency.
4. Red: first delivery assigns the free subscription.
5. Red: duplicate delivery creates no duplicate business state.

Completion: Users has no dependency on Billing; Billing owns its tables and consumes the event idempotently.

## Phase 6 — LLM Generate and Usage Reservation

1. Red: insufficient entitlement/quota prevents provider invocation.
2. Add a logical model resolver and deterministic fake provider adapter.
3. Red: successful generate reserves estimated usage and commits actual usage.
4. Red: provider failure releases the reservation.
5. Normalize response, provider usage, billing usage, and provider cost separately.
6. Add the HTTP generate endpoint after service behavior is protected.

Completion: LLM imports Billing only through `billing/index.ts`; provider schemas remain in LLM infra; usage records and reservations are idempotent.

## Architecture Tests

Introduce executable rules as soon as the first relevant violation becomes possible:

- service must not import Hono;
- router must not import repo/database/Redis;
- cross-module imports must target `index.ts`;
- cross-module repo/infra imports are forbidden;
- repos may import only their module-owned schema;
- the module dependency graph must be acyclic.

## Critical Flow Acceptance Tests

Before declaring the vertical slice complete, protect:

1. Phone OTP creates User + Account + Session.
2. One User can bind multiple Accounts.
3. One external Account cannot belong to multiple Users.
4. UserCreated initializes the free plan exactly once.
5. LLM generation records correct usage.
6. Insufficient quota prevents provider invocation.
7. Provider failure releases the reservation.
8. Duplicate event delivery creates no duplicate business data.

## Explicitly Deferred

- Real SMS provider until the local/fake boundary and core auth flow are stable.
- Google/Apple/email/password authentication.
- API key management UI and endpoints.
- Payment provider integration and paid-plan checkout.
- Production LLM provider SDKs until the fake-provider usage flow is complete.
- Streaming until non-streaming reservation/finalization is correct.
- Worker process, transactional outbox dispatcher, NATS/Kafka.
- Microservices, Kubernetes, service mesh, and service discovery.
