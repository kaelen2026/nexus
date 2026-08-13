# Users Module

## Responsibility

Users owns the stable business subject and user-facing profile/settings. Authentication accounts belong to Auth.

## Intended Shape

```text
users/
├── router/
├── service/
│   ├── create-user.ts
│   ├── get-current-user.ts
│   ├── get-user-status.ts
│   ├── update-profile.ts
│   └── update-settings.ts
├── repo/
│   ├── users.repo.ts
│   ├── profiles.repo.ts
│   └── settings.repo.ts
├── types.ts
├── errors.ts
└── index.ts
```

Only create these files when their use cases are implemented.

## Owned Data

- `users`
- `user_profiles`
- `user_settings`

User status is `active`, `suspended`, or `deleted`. It is distinct from Auth Account status.

## Creation and Events

First authentication coordinates creation as follows:

```text
Credential -> Auth Account -> Create User -> Bind Account -> Create Session
```

After durable User creation, Users publishes `users.user-created`. Billing consumes the fact to assign a free subscription. Users must not call Billing, which avoids a Users/Billing dependency cycle.

Users constructs and publishes the event only after the User/Account/Session transaction commits. Re-authentication of an existing Account does not republish `users.user-created`.

## Public API

Potential exports include `createUser`, `getUserStatus`, and a minimal user summary when another module genuinely needs them. Profile repos and internal update workflows stay private. `GET /users/me` obtains `userId` from `Identity.subject`.

## Current User

`GET /users/me` requires a Gateway-authenticated user Identity and loads the authoritative User from Users-owned storage. It does not return JWT claims as user data. Active Users receive their stable ID, status, and timestamps. Suspended Users receive `403 USER_SUSPENDED`; deleted or missing Users receive `404 USER_NOT_FOUND`. Auth Account status remains independent from User status.
