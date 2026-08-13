# Testing strategy

Nexus uses a test pyramid that keeps most feedback fast and reserves browser tests for complete user journeys.

## Layers

- Unit tests cover pure business rules, validation, and UI behavior.
- Integration tests exercise module public APIs with real PostgreSQL and Redis. Focused fakes remain appropriate for email, SMS, LLM providers, clocks, and IDs.
- Architecture tests enforce module boundaries and dependency direction.
- Playwright tests cover the critical vertical slice through the real web and API applications.

The current browser suite verifies email OTP authentication and `GET /users/me`, password login and recovery with session revocation, and authenticated LLM generation with recorded token usage.

## Commands

Start PostgreSQL and Redis before running integration or browser tests:

```sh
pnpm docker:up
```

Run the fast test suite:

```sh
pnpm test
```

Run all instrumented tests and enforce coverage thresholds:

```sh
pnpm coverage
```

Run the critical browser flows:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Coverage is enforced independently for API, web, and database packages at 80% statements, 75% branches, 80% functions, and 80% lines. Generated entry points, declarations, route composition, and database schema declarations are excluded; business logic is not.

CI runs formatting and linting, typechecking, coverage thresholds, browser flows, and the production build. Playwright traces and screenshots are retained on failure.
