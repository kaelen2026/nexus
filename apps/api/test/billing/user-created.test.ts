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
    sql`truncate billing_event_receipts, billing_subscriptions, billing_plans cascade`,
  )
})
afterAll(async () => database.close())

describe('users.user-created consumer', () => {
  it('assigns the free subscription exactly once under duplicate delivery', async () => {
    const eventBus = createInMemoryEventBus()
    createBillingModule({ database: database.client, eventBus })
    const event = {
      eventId: 'event-id',
      type: 'users.user-created' as const,
      occurredAt: '2026-08-13T00:00:00.000Z',
      payload: { userId: '00000000-0000-4000-8000-000000000001' },
    }

    await eventBus.publish(event)
    await eventBus.publish(event)
    await eventBus.publish({ ...event, eventId: 'second-event-id' })

    const [result] = await database.client.execute<{
      subscriptions: number
      receipts: number
      planKey: string
      status: string
    }>(sql`
      select
        count(distinct s.id)::int as subscriptions,
        count(distinct r.event_id)::int as receipts,
        min(p.key) as "planKey",
        min(s.status) as status
      from billing_subscriptions s
      join billing_plans p on p.id = s.plan_id
      cross join billing_event_receipts r
      where s.user_id = ${event.payload.userId}
    `)
    expect(result).toEqual({
      subscriptions: 1,
      receipts: 2,
      planKey: 'free',
      status: 'active',
    })
  })
})
