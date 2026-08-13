# Auth Module

## Responsibility

Auth owns authentication identities, credentials, sessions, refresh tokens, API keys, and the production of a runtime Identity. It does not own the stable business User or user profile.

```text
User 1:N Account
Account 1:N Credential
Account/User -> Session
Authentication -> Identity
```

For authenticated users, `Identity.subject` is `userId`; `accountId` is optional authentication context. Business modules normally operate on `userId`.

## Intended Shape

Create only files required by current behavior. The intended mature shape is:

```text
auth/
├── router/
│   ├── routes.ts
│   └── schema.ts
├── service/
│   ├── send-otp.ts
│   ├── verify-otp.ts
│   ├── refresh-session.ts
│   ├── logout.ts
│   ├── authenticate.ts
│   └── link-account.ts
├── repo/
│   ├── accounts.repo.ts
│   ├── sessions.repo.ts
│   └── refresh-tokens.repo.ts
├── infra/
│   ├── otp.ts
│   ├── token.ts
│   ├── password.ts
│   └── sms.ts
├── types.ts
├── errors.ts
└── index.ts
```

## Owned Data

- `auth_accounts`
- `auth_credentials`
- `auth_sessions`
- `auth_refresh_tokens`
- `auth_api_keys`

OTP challenges may live in Redis because they are short-lived authentication state. Auth owns their key format and lifecycle.

Redis SDK usage, client creation, connection lifecycle, and OTP challenge persistence stay inside Auth `infra`. Bootstrap may pass `REDIS_URL` through the Auth public composition API, but it must not import or operate the Redis SDK directly.

## Phone OTP Flow

```text
Send OTP
  -> normalize phone
  -> generate OTP
  -> store hash with expiry
  -> send plaintext OTP through SMS adapter

Verify OTP
  -> atomically consume valid challenge
  -> find or create Account
  -> create User on first authentication
  -> bind Account to User
  -> create Session
  -> issue access + refresh tokens
```

OTP consumption happens before identity persistence. A rejected, expired, or already consumed OTP must not touch PostgreSQL. The HTTP boundary maps all of these cases to the same unauthorized response so it does not disclose challenge state.

The same external Account cannot belong to multiple Users. Repeated authentication reuses the existing User and Account.

## Token Model

- Access token: short-lived JWT.
- Refresh token: opaque random value; persist only its hash.
- Session: server-side record and revocation boundary.
- Refresh rotation: every successful refresh replaces the token.
- Reuse detection: reuse of an already-rotated token revokes the affected session/token family.
- Logout revokes the current session; logout-all revokes every session for the User.
- API keys return plaintext once and persist only hash plus a safe prefix.

Access tokens use signed JWTs with issuer, audience, subject (`userId`), `accountId`, `sessionId`, issued-at, and expiry claims. Refresh tokens are 256-bit opaque random values. Their persisted representation is an HMAC-SHA-256 hash; plaintext is returned only to the client.

Rotation uses a conditional database update so one stored token can rotate only once. Detection of an already-rotated token commits revocation of the server-side Session and every Refresh Token in that Session before returning an error.

`POST /auth/otp/verify` returns a Bearer access token, its expiry, and an opaque refresh token. `POST /auth/refresh` accepts the refresh token, rotates it, and returns a new token pair. Invalid, expired, revoked, and reused refresh tokens all receive the same `401 INVALID_REFRESH_TOKEN` response.

Web clients can request `sessionMode: "cookie"` during OTP verification. In this mode, Auth writes the access token to the `__Host-nexus_access` cookie and the refresh token to the path-scoped `__Secure-nexus_refresh` cookie. Both cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`; token plaintext is omitted from the JSON response. A web client refreshes by calling `POST /auth/refresh` with credentials enabled, without reading or sending the refresh token in JavaScript.

Cookie mode does not replace Bearer mode. Non-browser clients continue to receive and submit token pairs in JSON.

The authentication gateway now enforces the configured `TRUSTED_ORIGINS` allowlist for unsafe requests carrying Auth cookies. Bearer clients are not subject to browser CSRF checks. Valid access tokens produce a runtime user Identity with `subject = userId`; token verification remains an Auth public capability while HTTP credential extraction stays in Gateway.

Never log OTPs, credentials, tokens, API keys, or Authorization headers.

Runtime composition accepts an `SmsSender` through the Auth public API. The server must not mount the production send-OTP path with a logger, no-op, or test fake standing in for SMS. A concrete provider adapter and its configuration are selected in a focused integration increment.

## Public API

`index.ts` should expose only capabilities needed outside Auth, such as authentication middleware composition or account-linking use cases. Repo and infra implementations remain private.
