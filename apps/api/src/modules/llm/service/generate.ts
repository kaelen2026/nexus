import type { DatabaseClient } from '@nexus/database'

import { LlmAccessDeniedError, LlmProviderError } from '../errors.js'
import type { LlmProvider } from '../infra/providers/types.js'
import { createRequest, failRequest, succeedRequest } from '../repo/requests.repo.js'
import type { BillingUsageAccess, GenerateInput, GenerateResult } from '../types.js'
import { resolveModel } from './model-resolver.js'

export function createGenerate(options: {
  database: DatabaseClient
  billing: BillingUsageAccess
  provider: LlmProvider
}) {
  return async (input: GenerateInput): Promise<GenerateResult> => {
    const entitled = await options.billing.getEntitlement({
      userId: input.userId,
      key: 'llm.generate',
    })
    if (!entitled) throw new LlmAccessDeniedError()

    const reservation = await options.billing.reserveUsage({
      userId: input.userId,
      key: 'llm.tokens',
      units: input.maxTokens,
    })
    if (!reservation) throw new LlmAccessDeniedError()

    const resolvedModel = resolveModel(input.model)
    let request: { requestId: string }
    try {
      request = await createRequest(options.database, {
        userId: input.userId,
        logicalModel: input.model,
        providerModel: resolvedModel.providerModel,
      })
    } catch (error) {
      await options.billing.releaseUsage({ reservationId: reservation.reservationId })
      throw error
    }

    let response: Awaited<ReturnType<LlmProvider['generate']>>
    try {
      response = await options.provider.generate({
        providerModel: resolvedModel.providerModel,
        prompt: input.prompt,
        maxTokens: input.maxTokens,
      })
    } catch (error) {
      await failRequest(options.database, {
        requestId: request.requestId,
        errorCode: 'PROVIDER_ERROR',
      })
      await options.billing.releaseUsage({ reservationId: reservation.reservationId })
      throw new LlmProviderError({ cause: error })
    }

    const totalTokens = response.usage.inputTokens + response.usage.outputTokens
    try {
      await options.billing.commitUsage({
        reservationId: reservation.reservationId,
        actualUnits: totalTokens,
      })
      await succeedRequest(options.database, {
        requestId: request.requestId,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      })
    } catch (error) {
      await failRequest(options.database, {
        requestId: request.requestId,
        errorCode: 'INTERNAL_ERROR',
      })
      throw error
    }
    return {
      requestId: request.requestId,
      model: input.model,
      text: response.text,
      usage: { ...response.usage, totalTokens },
    }
  }
}
