import type { DatabaseClient } from '@nexus/database'

import type { LlmProvider } from './infra/providers/types.js'
import { createGenerate } from './service/generate.js'
import type { BillingUsageAccess } from './types.js'

export function createLlmModule(options: {
  database: DatabaseClient
  billing: BillingUsageAccess
  provider: LlmProvider
}) {
  return { generate: createGenerate(options) }
}
