import type { DatabaseClient } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { llmRequests } from './schema.js'

export async function createRequest(
  database: DatabaseClient,
  input: { userId: string; logicalModel: string; providerModel: string },
): Promise<{ requestId: string }> {
  const [request] = await database
    .insert(llmRequests)
    .values(input)
    .returning({ requestId: llmRequests.id })
  if (!request) throw new Error('Failed to create LLM request')
  return request
}

export async function succeedRequest(
  database: DatabaseClient,
  input: { requestId: string; inputTokens: number; outputTokens: number },
): Promise<void> {
  await database
    .update(llmRequests)
    .set({
      status: 'succeeded',
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      completedAt: new Date(),
    })
    .where(eq(llmRequests.id, input.requestId))
}

export async function failRequest(
  database: DatabaseClient,
  input: { requestId: string; errorCode: 'PROVIDER_ERROR' | 'INTERNAL_ERROR' },
): Promise<void> {
  await database
    .update(llmRequests)
    .set({ status: 'failed', errorCode: input.errorCode, completedAt: new Date() })
    .where(eq(llmRequests.id, input.requestId))
}
