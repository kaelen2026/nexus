import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createBillingModule } from '../../src/modules/billing/index.js'
import { createInMemoryEventBus } from '../../src/shared/events/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(
    sql`truncate billing_event_receipts, billing_subscriptions, billing_plan_quotas,
      billing_plan_entitlements, billing_plans cascade`,
  )
})
afterAll(async () => database.close())

describe('Billing access policy', () => {
  it('resolves entitlements and quotas through the active subscription', async () => {
    const eventBus = createInMemoryEventBus()
    const billing = createBillingModule({ database: database.client, eventBus })
    const userId = '00000000-0000-4000-8000-000000000001'

    await eventBus.publish({
      eventId: 'event-id',
      type: 'users.user-created',
      occurredAt: '2026-08-13T00:00:00.000Z',
      payload: { userId },
    })

    await expect(billing.getEntitlement({ userId, key: 'llm.generate' })).resolves.toBe(true)
    await expect(billing.getEntitlement({ userId, key: 'llm.model.premium' })).resolves.toBe(false)
    await expect(billing.getQuota({ userId, key: 'llm.tokens' })).resolves.toEqual({
      limit: 10_000,
      used: 0,
      remaining: 10_000,
    })
    await expect(billing.getQuota({ userId, key: 'unknown' })).resolves.toBeNull()

    billing.close()
  })

  it('does not grant policy from an ended subscription', async () => {
    const eventBus = createInMemoryEventBus()
    const billing = createBillingModule({ database: database.client, eventBus })
    const userId = '00000000-0000-4000-8000-000000000002'

    await eventBus.publish({
      eventId: 'event-id',
      type: 'users.user-created',
      occurredAt: '2026-08-13T00:00:00.000Z',
      payload: { userId },
    })
    await database.client.execute(
      sql`update billing_subscriptions set status = 'ended' where user_id = ${userId}`,
    )

    await expect(billing.getEntitlement({ userId, key: 'llm.generate' })).resolves.toBe(false)
    await expect(billing.getQuota({ userId, key: 'llm.tokens' })).resolves.toBeNull()

    billing.close()
  })
})
