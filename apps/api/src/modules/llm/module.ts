import type { DatabaseClient } from '@nexus/database'

import type { LlmProvider } from './infra/providers/types.js'
import { createGenerate } from './service/generate.js'
import { createGenerateStream } from './service/generate-stream.js'
import type { BillingUsageAccess } from './types.js'

export function createLlmModule(options: {
  database: DatabaseClient
  billing: BillingUsageAccess
  provider: LlmProvider
  providerModel?: string
}) {
  return { generate: createGenerate(options), generateStream: createGenerateStream(options) }
}
