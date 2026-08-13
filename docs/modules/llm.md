# LLM Module

## Responsibility

LLM owns model resolution, provider/channel selection, provider adapters, request records, normalized provider usage, pricing, and provider cost. Billing owns user quota and billable usage.

## Intended Shape

```text
llm/
├── router/
│   ├── routes.ts
│   └── schema.ts
├── service/
│   ├── generate.ts
│   ├── stream.ts
│   ├── model-resolver.ts
│   └── channel-selector.ts
├── repo/requests.repo.ts
├── infra/
│   ├── providers/
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── gemini.ts
│   ├── pricing/
│   └── health/
├── types.ts
├── errors.ts
└── index.ts
```

## Model and Provider Design

Keep four concepts distinct:

```text
Logical Model -> Provider Model -> Provider -> Channel
reasoning-pro     model-x          OpenAI      channel-us-1
```

Business code selects a logical model and does not bind directly to provider SDKs. Provider-specific request/response schemas stay in `infra/providers`.

Adapters expose normalized `generate()` and `stream()` behavior. Normalized provider usage may include `inputTokens`, `outputTokens`, `cachedTokens`, and `reasoningTokens`.

## Generate Flow

```text
Resolve Logical Model
  -> Billing.getEntitlement
  -> Billing.reserveUsage
  -> Select Channel
  -> Provider Adapter
  -> Normalize Response and Provider Usage
  -> Calculate Provider Cost and Billable Usage
  -> Billing.commitUsage
```

Provider failure finalizes the request and releases the reservation.

The initial non-streaming service resolves the `standard` logical model, checks the `llm.generate` entitlement, and reserves the requested total-token budget under `llm.tokens`. Provider success commits normalized input plus output tokens; provider failure releases the reservation before propagating a provider-neutral error. A failure after the Provider succeeds does not release consumed quota.

`POST /llm/generate` requires a Gateway-authenticated User and always takes `userId` from `Identity.subject`. The router validates the logical model, prompt, and requested token budget. Missing entitlement or quota maps to `403 LLM_ACCESS_DENIED`; adapter failures map to `502 LLM_PROVIDER_ERROR` without exposing provider details. Durable LLM request records remain in the next increment.

## Streaming

Normalized events are `start`, `text_delta`, `tool_call_delta`, `usage`, `done`, and `error`.

- Before the first emitted chunk, retry or provider fallback is allowed.
- After the first emitted chunk, cross-provider fallback is disabled by default to avoid duplicated or inconsistent output.

## Usage Boundaries

- Provider Usage describes what the provider reports.
- Billing Usage is expressed as token, request, or credit units.
- Provider Cost is internal LLM cost.

These values must not be conflated even when they are derived from the same response.
