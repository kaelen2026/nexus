import { describe, expect, it, vi } from 'vitest'

import {
  createLlmModule,
  LlmAccessDeniedError,
  LlmProviderError,
} from '../../src/modules/llm/index.js'

describe('LLM generate', () => {
  it('does not reserve usage or invoke the provider without the generate entitlement', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(false),
      reserveUsage: vi.fn(),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn(),
    }
    const provider = { generate: vi.fn() }
    const llm = createLlmModule({ billing, provider })

    await expect(
      llm.generate({ userId: 'user-id', model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    ).rejects.toBeInstanceOf(LlmAccessDeniedError)
    expect(billing.reserveUsage).not.toHaveBeenCalled()
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('does not invoke the provider when quota cannot be reserved', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn().mockResolvedValue(null),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn(),
    }
    const provider = { generate: vi.fn() }
    const llm = createLlmModule({ billing, provider })

    await expect(
      llm.generate({ userId: 'user-id', model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    ).rejects.toBeInstanceOf(LlmAccessDeniedError)
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('commits normalized actual usage after provider success', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn().mockResolvedValue({ reservationId: 'reservation-id' }),
      commitUsage: vi.fn().mockResolvedValue(undefined),
      releaseUsage: vi.fn(),
    }
    const provider = {
      generate: vi.fn().mockResolvedValue({
        text: 'Hello back',
        usage: { inputTokens: 12, outputTokens: 8 },
      }),
    }
    const llm = createLlmModule({ billing, provider })

    await expect(
      llm.generate({ userId: 'user-id', model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    ).resolves.toEqual({
      model: 'standard',
      text: 'Hello back',
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    })
    expect(billing.reserveUsage).toHaveBeenCalledWith({
      userId: 'user-id',
      key: 'llm.tokens',
      units: 100,
    })
    expect(provider.generate).toHaveBeenCalledWith({
      providerModel: 'fake-standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    expect(billing.commitUsage).toHaveBeenCalledWith({
      reservationId: 'reservation-id',
      actualUnits: 20,
    })
    expect(billing.releaseUsage).not.toHaveBeenCalled()
  })

  it('releases reserved usage after provider failure', async () => {
    const providerError = new Error('provider unavailable')
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn().mockResolvedValue({ reservationId: 'reservation-id' }),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn().mockResolvedValue(undefined),
    }
    const provider = { generate: vi.fn().mockRejectedValue(providerError) }
    const llm = createLlmModule({ billing, provider })

    const result = llm.generate({
      userId: 'user-id',
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    await expect(result).rejects.toMatchObject({ name: 'LlmProviderError', cause: providerError })
    await expect(result).rejects.toBeInstanceOf(LlmProviderError)
    expect(billing.commitUsage).not.toHaveBeenCalled()
    expect(billing.releaseUsage).toHaveBeenCalledWith({ reservationId: 'reservation-id' })
  })
})
