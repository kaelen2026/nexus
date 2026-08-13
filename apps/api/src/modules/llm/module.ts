import type { LlmProvider } from './infra/providers/types.js'
import { createGenerate } from './service/generate.js'
import type { BillingUsageAccess } from './types.js'

export function createLlmModule(options: { billing: BillingUsageAccess; provider: LlmProvider }) {
  return { generate: createGenerate(options) }
}
