# Business Event Contracts

## Semantics

Use a direct module service call when the caller needs a synchronous result. Publish an event only for a fact that has already occurred.

Initial delivery is synchronous and in-memory. The bus itself does not retry, persist, or provide
at-least-once delivery; consumers are nevertheless designed to be idempotent so the transport can
later evolve to an at-least-once outbox/broker without changing business effects.

## Envelope

Every business event should carry:

```ts
interface EventEnvelope<TType extends string, TPayload> {
  eventId: string
  type: TType
  occurredAt: string
  correlationId?: string
  payload: TPayload
}
```

Do not put secrets, tokens, OTPs, credentials, or full prompts in events.

## Initial Events

### `users.user-created`

Published after the User is durably created.

```ts
interface UserCreatedPayload {
  userId: string
}
```

Billing consumes this event and assigns the free subscription exactly once, using `eventId` or the business uniqueness constraint for idempotency.

## Planned Events

The following names describe future contracts; they are not currently declared or published in
source.

### `billing.subscription-activated`

Published after a subscription becomes active. The initial vertical slice does not require a consumer.

### `llm.request-completed`

Published after an LLM request and its usage finalization are durable. It must reference IDs rather than embedding full prompts or provider secrets.

## Transactional Outbox Evolution

For state events that cannot tolerate loss:

```text
BEGIN
  write business state
  write outbox event
COMMIT

Outbox Dispatcher -> Event Bus
```

The event name, version, envelope, and payload remain stable when the transport changes from in-memory to NATS or Kafka.
