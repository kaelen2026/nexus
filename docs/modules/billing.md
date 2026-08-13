# Billing Module

## Responsibility

Billing owns commercial access, entitlements, quotas, reservations, and user-visible usage. It does not own provider cost.

## Intended Shape

```text
billing/
├── router/
├── service/
│   ├── assign-free-plan.ts
│   ├── get-entitlement.ts
│   ├── get-quota.ts
│   ├── reserve-usage.ts
│   ├── commit-usage.ts
│   └── release-usage.ts
├── repo/
│   ├── plans.repo.ts
│   ├── subscriptions.repo.ts
│   ├── usage.repo.ts
│   └── reservations.repo.ts
├── infra/payments/
├── types.ts
├── errors.ts
└── index.ts
```

## Owned Data

- `billing_plans`
- `billing_subscriptions`
- `billing_entitlements`
- `billing_grants`
- `billing_usage_records`
- `billing_usage_reservations`

## Concepts

Plan, Subscription, Entitlement, Quota, and Usage are different concepts. Product behavior must not branch on plan names.

```ts
// Forbidden
if (plan === 'pro') allowPremiumModel()

// Required concept
getEntitlement(userId, 'llm.model.premium')
```

## Reservation Protocol

```text
getEntitlement -> getQuota -> reserveUsage -> execute
                                         success -> commitUsage(actual)
                                         failure -> releaseUsage
```

Reservations prevent concurrent expensive operations from overspending quota. Commit and release must be idempotent.

## Events

Billing idempotently consumes `users.user-created` and creates the free subscription exactly once. It may publish facts such as `billing.subscription-activated` after durable state changes.

The initial implementation uses a synchronous in-memory EventBus. The consumer transaction first claims the event in `billing_event_receipts`, ensures the `free` Plan exists, and then creates the User's unique active Subscription. Duplicate delivery of the same event and delivery under a different event ID are both safe because receipt and User subscription uniqueness are enforced in PostgreSQL.

## Public API

LLM may import entitlement, quota, reserve, commit, and release capabilities only through `billing/index.ts`. It must never access Billing repos or tables.
