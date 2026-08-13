import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { LlmAccessDeniedError, LlmProviderError } from '../../src/modules/llm/index.js'

const identity = {
  type: 'user' as const,
  subject: 'user-id',
  accountId: 'account-id',
  sessionId: 'session-id',
  roles: [],
  scopes: [],
}

describe('POST /llm/generate', () => {
  it('generates for the authenticated User without accepting a caller-supplied userId', async () => {
    const generate = vi.fn().mockResolvedValue({
      requestId: 'request-id',
      model: 'standard',
      text: 'Hello back',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    })
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      generate,
    })

    const response = await app.request('/llm/generate', {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    })

    expect(response.status).toBe(200)
    expect(generate).toHaveBeenCalledWith({
      userId: 'user-id',
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    await expect(response.json()).resolves.toEqual({
      requestId: 'request-id',
      model: 'standard',
      text: 'Hello back',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    })
  })

  it('rejects unauthenticated requests before invoking LLM', async () => {
    const generate = vi.fn()
    const app = createApp({ generate })

    const response = await app.request('/llm/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    })

    expect(response.status).toBe(401)
    expect(generate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    })
  })

  it.each([
    null,
    {},
    { model: 'unknown', prompt: 'Hello', maxTokens: 100 },
    { model: 'standard', prompt: '', maxTokens: 100 },
    { model: 'standard', prompt: 'Hello', maxTokens: 0 },
    { model: 'standard', prompt: 'Hello', maxTokens: 100_001 },
  ])('rejects invalid input without invoking LLM: %j', async (body) => {
    const generate = vi.fn()
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      generate,
    })

    const response = await app.request('/llm/generate', {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(400)
    expect(generate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    })
  })

  it('maps unavailable entitlement or quota to a stable forbidden response', async () => {
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      generate: vi.fn().mockRejectedValue(new LlmAccessDeniedError()),
    })

    const response = await app.request('/llm/generate', {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'LLM_ACCESS_DENIED', message: 'LLM generation is not available' },
    })
  })

  it('maps provider failures without exposing provider details', async () => {
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      generate: vi.fn().mockRejectedValue(new LlmProviderError()),
    })

    const response = await app.request('/llm/generate', {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'LLM_PROVIDER_ERROR', message: 'LLM provider is unavailable' },
    })
  })
})
