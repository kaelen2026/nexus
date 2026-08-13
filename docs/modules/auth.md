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

The same external Account cannot belong to multiple Users. Repeated authentication reuses the existing User and Account.

## Token Model

- Access token: short-lived JWT.
- Refresh token: opaque random value; persist only its hash.
- Session: server-side record and revocation boundary.
- Refresh rotation: every successful refresh replaces the token.
- Reuse detection: reuse of an already-rotated token revokes the affected session/token family.
- Logout revokes the current session; logout-all revokes every session for the User.
- API keys return plaintext once and persist only hash plus a safe prefix.

Never log OTPs, credentials, tokens, API keys, or Authorization headers.

## Public API

`index.ts` should expose only capabilities needed outside Auth, such as authentication middleware composition or account-linking use cases. Repo and infra implementations remain private.
