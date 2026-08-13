# Nexus Web

Next.js frontend for Nexus. The first vertical slice supports phone OTP authentication,
HttpOnly cookie sessions, and authenticated LLM generation.

## Local development

Install dependencies from the repository root and configure the public API origin:

```bash
pnpm install
cp .env.example .env
pnpm --filter @nexus/web dev
```

The web app listens on `http://localhost:3001` and expects the API at
`NEXT_PUBLIC_API_BASE_URL` (`http://localhost:3000` by default). The API must include
`http://localhost:3001` in `TRUSTED_ORIGINS`.

Authentication requests always use `credentials: "include"`. Browser code never reads or stores
access and refresh token plaintext. Protected API requests that receive `401` share a single
cookie refresh request and retry once; an unrecoverable session returns the user to `/login`.
The account menu can revoke the current Session or every Session owned by the User. Successful
logout clears client query state before navigation; failed logout remains retryable in place.

The authenticated workspace calls `POST /llm/generate` with the logical `standard` model and a
user-selected output limit. It renders normalized token usage, supports copying the response,
and maps entitlement, provider, validation, and expired-session failures to stable UI states.

## Quality checks

```bash
pnpm --filter @nexus/web test
pnpm --filter @nexus/web typecheck
pnpm --filter @nexus/web build
pnpm check
```
