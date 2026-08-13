import type { DatabaseClient } from '@nexus/database'

import { LlmAccessDeniedError, LlmProviderError } from '../errors.js'
import type { LlmProvider } from '../infra/providers/types.js'
import { createRequest, failRequest, succeedRequest } from '../repo/requests.repo.js'
import type {
  BillingUsageAccess,
  GenerateInput,
  GenerateStream,
  GenerateStreamEvent,
} from '../types.js'
import { resolveModel } from './model-resolver.js'

export function createGenerateStream(options: {
  database: DatabaseClient
  billing: BillingUsageAccess
  provider: LlmProvider
  providerModel?: string
}): GenerateStream {
  return async (input: GenerateInput) => {
    if (!(await options.billing.getEntitlement({ userId: input.userId, key: 'llm.generate' }))) {
      throw new LlmAccessDeniedError()
    }
    if (!options.provider.stream) throw new LlmProviderError()

    const resolvedModel = resolveModel(input.model, options.providerModel)
    const inputTokens = await options.provider.countInputTokens({
      providerModel: resolvedModel.providerModel,
      prompt: input.prompt,
    })
    const outputTokenBudget = input.maxTokens - inputTokens
    if (outputTokenBudget < 1) throw new LlmAccessDeniedError()

    const reservation = await options.billing.reserveUsage({
      userId: input.userId,
      key: 'llm.tokens',
      units: input.maxTokens,
    })
    if (!reservation) throw new LlmAccessDeniedError()
    const reservationId = reservation.reservationId

    let request: { requestId: string }
    try {
      request = await createRequest(options.database, {
        userId: input.userId,
        logicalModel: input.model,
        providerModel: resolvedModel.providerModel,
      })
    } catch (error) {
      await options.billing.releaseUsage({ reservationId })
      throw error
    }

    let providerEvents: AsyncIterable<
      Awaited<ReturnType<NonNullable<LlmProvider['stream']>>> extends AsyncIterable<infer T>
        ? T
        : never
    >
    try {
      providerEvents = await options.provider.stream({
        providerModel: resolvedModel.providerModel,
        prompt: input.prompt,
        maxTokens: outputTokenBudget,
      })
    } catch (error) {
      await failRequest(options.database, {
        requestId: request.requestId,
        errorCode: 'PROVIDER_ERROR',
      })
      await options.billing.releaseUsage({ reservationId })
      throw new LlmProviderError({ cause: error })
    }

    async function* events(): AsyncGenerator<GenerateStreamEvent> {
      let providerCompleted = false
      let failureHandled = false
      try {
        for await (const event of providerEvents) {
          if (event.type === 'delta') {
            yield event
            continue
          }
          const totalTokens = event.usage.inputTokens + event.usage.outputTokens
          providerCompleted = true
          await options.billing.commitUsage({
            reservationId,
            actualUnits: totalTokens,
          })
          await succeedRequest(options.database, {
            requestId: request.requestId,
            ...event.usage,
          })
          yield { type: 'completed', usage: { ...event.usage, totalTokens } }
          return
        }
        throw new Error('Provider stream ended without completion')
      } catch (error) {
        await failRequest(options.database, {
          requestId: request.requestId,
          errorCode: providerCompleted ? 'INTERNAL_ERROR' : 'PROVIDER_ERROR',
        })
        if (!providerCompleted) await options.billing.releaseUsage({ reservationId })
        failureHandled = true
        if (providerCompleted) throw error
        throw error instanceof LlmProviderError ? error : new LlmProviderError({ cause: error })
      } finally {
        if (!providerCompleted && !failureHandled) {
          await failRequest(options.database, {
            requestId: request.requestId,
            errorCode: 'PROVIDER_ERROR',
          })
          await options.billing.releaseUsage({ reservationId })
        }
      }
    }

    return { requestId: request.requestId, model: input.model, events: events() }
  }
}
