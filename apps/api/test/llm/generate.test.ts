import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLlmModule,
  LlmAccessDeniedError,
  LlmProviderError,
} from '../../src/modules/llm/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => database.client.execute(sql`truncate llm_requests cascade`))
afterAll(async () => database.close())

const userId = '00000000-0000-4000-8000-000000000031'

describe('LLM generate', () => {
  it('commits actual usage after a completed provider stream', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn().mockResolvedValue({ reservationId: 'stream-reservation' }),
      commitUsage: vi.fn().mockResolvedValue(undefined),
      releaseUsage: vi.fn(),
    }
    const llm = createLlmModule({
      database: database.client,
      billing,
      provider: {
        countInputTokens: vi.fn().mockResolvedValue(2),
        generate: vi.fn(),
        stream: vi.fn().mockResolvedValue(
          (async function* () {
            yield { type: 'delta' as const, text: 'Hello back' }
            yield {
              type: 'completed' as const,
              usage: { inputTokens: 2, outputTokens: 3 },
            }
          })(),
        ),
      },
    })

    const result = await llm.generateStream({
      userId,
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    const events = []
    for await (const event of result.events) events.push(event)

    expect(events).toEqual([
      { type: 'delta', text: 'Hello back' },
      { type: 'completed', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } },
    ])
    expect(billing.commitUsage).toHaveBeenCalledWith({
      reservationId: 'stream-reservation',
      actualUnits: 5,
    })
    expect(billing.releaseUsage).not.toHaveBeenCalled()
  })

  it('releases reserved usage when a consumer cancels a provider stream', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn().mockResolvedValue({ reservationId: 'stream-reservation' }),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn().mockResolvedValue(undefined),
    }
    const llm = createLlmModule({
      database: database.client,
      billing,
      provider: {
        countInputTokens: vi.fn().mockResolvedValue(2),
        generate: vi.fn(),
        stream: vi.fn().mockResolvedValue(
          (async function* () {
            yield { type: 'delta' as const, text: 'partial' }
            yield {
              type: 'completed' as const,
              usage: { inputTokens: 2, outputTokens: 3 },
            }
          })(),
        ),
      },
    })

    const result = await llm.generateStream({
      userId,
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    const iterator = result.events[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: 'delta', text: 'partial' },
    })
    await iterator.return?.()

    expect(billing.commitUsage).not.toHaveBeenCalled()
    expect(billing.releaseUsage).toHaveBeenCalledWith({ reservationId: 'stream-reservation' })
  })

  it('does not reserve usage or invoke the provider without the generate entitlement', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(false),
      reserveUsage: vi.fn(),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn(),
    }
    const provider = { countInputTokens: vi.fn(), generate: vi.fn() }
    const llm = createLlmModule({ database: database.client, billing, provider })

    await expect(
      llm.generate({ userId, model: 'standard', prompt: 'Hello', maxTokens: 100 }),
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
    const provider = { countInputTokens: vi.fn(), generate: vi.fn() }
    const llm = createLlmModule({ database: database.client, billing, provider })

    await expect(
      llm.generate({ userId, model: 'standard', prompt: 'Hello', maxTokens: 100 }),
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
      countInputTokens: vi.fn().mockResolvedValue(12),
      generate: vi.fn().mockResolvedValue({
        text: 'Hello back',
        usage: { inputTokens: 12, outputTokens: 8 },
      }),
    }
    const llm = createLlmModule({ database: database.client, billing, provider })

    await expect(
      llm.generate({ userId, model: 'standard', prompt: 'Hello', maxTokens: 100 }),
    ).resolves.toEqual({
      requestId: expect.any(String),
      model: 'standard',
      text: 'Hello back',
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
    })
    expect(billing.reserveUsage).toHaveBeenCalledWith({
      userId,
      key: 'llm.tokens',
      units: 100,
    })
    expect(provider.generate).toHaveBeenCalledWith({
      providerModel: 'fake-standard',
      prompt: 'Hello',
      maxTokens: 88,
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
    const provider = {
      countInputTokens: vi.fn().mockResolvedValue(12),
      generate: vi.fn().mockRejectedValue(providerError),
    }
    const llm = createLlmModule({ database: database.client, billing, provider })

    const result = llm.generate({
      userId,
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })
    await expect(result).rejects.toMatchObject({ name: 'LlmProviderError', cause: providerError })
    await expect(result).rejects.toBeInstanceOf(LlmProviderError)
    expect(billing.commitUsage).not.toHaveBeenCalled()
    expect(billing.releaseUsage).toHaveBeenCalledWith({ reservationId: 'reservation-id' })
  })

  it('rejects a total-token budget that cannot fit the prompt before reserving usage', async () => {
    const billing = {
      getEntitlement: vi.fn().mockResolvedValue(true),
      reserveUsage: vi.fn(),
      commitUsage: vi.fn(),
      releaseUsage: vi.fn(),
    }
    const provider = {
      countInputTokens: vi.fn().mockResolvedValue(100),
      generate: vi.fn(),
    }
    const llm = createLlmModule({ database: database.client, billing, provider })

    await expect(
      llm.generate({ userId, model: 'standard', prompt: 'A large prompt', maxTokens: 100 }),
    ).rejects.toBeInstanceOf(LlmAccessDeniedError)
    expect(billing.reserveUsage).not.toHaveBeenCalled()
    expect(provider.generate).not.toHaveBeenCalled()
  })
})
