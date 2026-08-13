import { LlmAccessDeniedError, LlmProviderError } from '../errors.js'
import type { LlmProvider } from '../infra/providers/types.js'
import type { BillingUsageAccess, GenerateInput, GenerateResult } from '../types.js'
import { resolveModel } from './model-resolver.js'

export function createGenerate(options: { billing: BillingUsageAccess; provider: LlmProvider }) {
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
    let response: Awaited<ReturnType<LlmProvider['generate']>>
    try {
      response = await options.provider.generate({
        providerModel: resolvedModel.providerModel,
        prompt: input.prompt,
        maxTokens: input.maxTokens,
      })
    } catch (error) {
      await options.billing.releaseUsage({ reservationId: reservation.reservationId })
      throw new LlmProviderError({ cause: error })
    }

    const totalTokens = response.usage.inputTokens + response.usage.outputTokens
    await options.billing.commitUsage({
      reservationId: reservation.reservationId,
      actualUnits: totalTokens,
    })
    return {
      model: input.model,
      text: response.text,
      usage: { ...response.usage, totalTokens },
    }
  }
}
