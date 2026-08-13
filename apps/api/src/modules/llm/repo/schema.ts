import { sql } from 'drizzle-orm'
import { check, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const llmRequestStatus = pgEnum('llm_request_status', ['processing', 'succeeded', 'failed'])

export const llmRequests = pgTable(
  'llm_requests',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    logicalModel: text('logical_model').notNull(),
    providerModel: text('provider_model').notNull(),
    status: llmRequestStatus().notNull().default('processing'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'llm_requests_input_tokens_non_negative',
      sql`${table.inputTokens} is null or ${table.inputTokens} >= 0`,
    ),
    check(
      'llm_requests_output_tokens_non_negative',
      sql`${table.outputTokens} is null or ${table.outputTokens} >= 0`,
    ),
  ],
)
