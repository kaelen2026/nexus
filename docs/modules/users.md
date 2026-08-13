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

## Public API

Potential exports include `createUser`, `getUserStatus`, and a minimal user summary when another module genuinely needs them. Profile repos and internal update workflows stay private. `GET /users/me` obtains `userId` from `Identity.subject`.
