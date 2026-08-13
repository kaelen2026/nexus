# Test-Driven Development

All product behavior is developed in short Red, Green, Refactor cycles.

## Workflow

### Red

Write one test for the next observable behavior and run it to confirm that it fails for the expected reason. A test that passes before implementation does not establish the requirement.

### Green

Add the smallest production change that satisfies the test. Avoid building adjacent capabilities that have no failing test.

### Refactor

Remove duplication, clarify names, and improve boundaries while the suite remains green. Refactoring must not change externally observable behavior.

## Test Levels

- Unit tests cover pure business rules with no network or persistence.
- Module integration tests call the module public API and use real PostgreSQL or Redis when persistence semantics matter.
- HTTP tests call the Hono app through `app.request()` and verify validation, authentication, status codes, and response mapping.
- Critical-flow tests protect complete cross-module business outcomes.
- Architecture tests enforce dependency and ownership rules.

Prefer deterministic fakes at true infrastructure seams: SMS senders, LLM providers, clocks, and ID generators. Do not mock Hono internals, Drizzle query chains, or another module's private implementation.

## Naming and Placement

API tests live under `apps/api/test` and use `*.test.ts`. Group tests by behavior or vertical slice rather than mirroring every production file.

Run once with `pnpm test`; during a Red/Green loop use `pnpm --filter @nexus/api test:watch`. Before completion run `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## First Slice

The Phone OTP slice begins with failing tests in this order:

1. Sending an OTP stores a hashed, expiring challenge and invokes the SMS seam.
2. Verifying a valid OTP creates one User, Account, and Session.
3. Repeated login reuses the existing User and Account.
4. Invalid, expired, or consumed OTPs are rejected.
5. The same external Account cannot belong to multiple Users.
6. `users.user-created` initializes the free subscription exactly once.
7. The access token resolves `Identity.subject` to `userId` for `GET /users/me`.
