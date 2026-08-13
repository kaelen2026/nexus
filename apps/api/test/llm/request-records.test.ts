import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLlmModule, LlmProviderError } from '../../src/modules/llm/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(sql`truncate llm_requests cascade`)
})
afterAll(async () => database.close())

function createBilling() {
  return {
    getEntitlement: vi.fn().mockResolvedValue(true),
    reserveUsage: vi.fn().mockResolvedValue({ reservationId: crypto.randomUUID() }),
    commitUsage: vi.fn().mockResolvedValue(undefined),
    releaseUsage: vi.fn().mockResolvedValue(undefined),
  }
}

describe('LLM request records', () => {
  it('persists the normalized provider usage after a successful request', async () => {
    const llm = createLlmModule({
      database: database.client,
      billing: createBilling(),
      provider: {
        countInputTokens: vi.fn().mockResolvedValue(12),
        generate: vi.fn().mockResolvedValue({
          text: 'Hello back',
          usage: { inputTokens: 12, outputTokens: 8 },
        }),
      },
    })

    const result = await llm.generate({
      userId: '00000000-0000-4000-8000-000000000021',
      model: 'standard',
      prompt: 'Hello',
      maxTokens: 100,
    })

    const [record] = await database.client.execute<{
      id: string
      userId: string
      logicalModel: string
      providerModel: string
      status: string
      inputTokens: number
      outputTokens: number
      completedAt: string | null
    }>(sql`
      select
        id,
        user_id as "userId",
        logical_model as "logicalModel",
        provider_model as "providerModel",
        status,
        input_tokens as "inputTokens",
        output_tokens as "outputTokens",
        completed_at as "completedAt"
      from llm_requests
    `)
    expect(record).toMatchObject({
      id: result.requestId,
      userId: '00000000-0000-4000-8000-000000000021',
      logicalModel: 'standard',
      providerModel: 'fake-standard',
      status: 'succeeded',
      inputTokens: 12,
      outputTokens: 8,
    })
    expect(Date.parse(record?.completedAt ?? '')).not.toBeNaN()
  })

  it('persists a provider-neutral failed state after provider failure', async () => {
    const llm = createLlmModule({
      database: database.client,
      billing: createBilling(),
      provider: {
        countInputTokens: vi.fn().mockResolvedValue(1),
        generate: vi.fn().mockRejectedValue(new Error('secret provider detail')),
      },
    })

    await expect(
      llm.generate({
        userId: '00000000-0000-4000-8000-000000000022',
        model: 'standard',
        prompt: 'Hello',
        maxTokens: 100,
      }),
    ).rejects.toBeInstanceOf(LlmProviderError)

    const [record] = await database.client.execute<{
      status: string
      errorCode: string | null
      inputTokens: number | null
      outputTokens: number | null
    }>(sql`
      select
        status,
        error_code as "errorCode",
        input_tokens as "inputTokens",
        output_tokens as "outputTokens"
      from llm_requests
    `)
    expect(record).toEqual({
      status: 'failed',
      errorCode: 'PROVIDER_ERROR',
      inputTokens: null,
      outputTokens: null,
    })
  })

  it('records an internal failure without releasing usage after provider success', async () => {
    const billing = createBilling()
    billing.commitUsage.mockRejectedValue(new Error('database unavailable'))
    const llm = createLlmModule({
      database: database.client,
      billing,
      provider: {
        countInputTokens: vi.fn().mockResolvedValue(4),
        generate: vi.fn().mockResolvedValue({
          text: 'Hello back',
          usage: { inputTokens: 4, outputTokens: 6 },
        }),
      },
    })

    await expect(
      llm.generate({
        userId: '00000000-0000-4000-8000-000000000023',
        model: 'standard',
        prompt: 'Hello',
        maxTokens: 100,
      }),
    ).rejects.toThrow('database unavailable')

    const [record] = await database.client.execute<{ status: string; errorCode: string | null }>(
      sql`select status, error_code as "errorCode" from llm_requests`,
    )
    expect(record).toEqual({ status: 'failed', errorCode: 'INTERNAL_ERROR' })
    expect(billing.releaseUsage).not.toHaveBeenCalled()
  })
})
