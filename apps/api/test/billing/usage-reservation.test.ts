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
    sql`truncate billing_usage_records, billing_usage_reservations, billing_event_receipts,
      billing_subscriptions, billing_plan_quotas, billing_plan_entitlements, billing_plans cascade`,
  )
})
afterAll(async () => database.close())

async function createFreeUser(userId: string) {
  const eventBus = createInMemoryEventBus()
  const billing = createBillingModule({ database: database.client, eventBus })
  await eventBus.publish({
    eventId: `event-${userId}`,
    type: 'users.user-created',
    occurredAt: '2026-08-13T00:00:00.000Z',
    payload: { userId },
  })
  return billing
}

describe('Billing usage reservation', () => {
  it('reserves within quota and commits actual usage idempotently', async () => {
    const userId = '00000000-0000-4000-8000-000000000011'
    const billing = await createFreeUser(userId)

    const reservation = await billing.reserveUsage({ userId, key: 'llm.tokens', units: 100 })
    expect(reservation).not.toBeNull()
    if (!reservation) throw new Error('Expected usage reservation')
    await billing.commitUsage({ reservationId: reservation.reservationId, actualUnits: 40 })
    await billing.commitUsage({ reservationId: reservation.reservationId, actualUnits: 40 })

    await expect(billing.getQuota({ userId, key: 'llm.tokens' })).resolves.toEqual({
      limit: 10_000,
      used: 40,
      remaining: 9_960,
    })
    const [counts] = await database.client.execute<{ records: number }>(
      sql`select count(*)::int as records from billing_usage_records`,
    )
    expect(counts?.records).toBe(1)
    billing.close()
  })

  it('rejects reservations that exceed remaining quota', async () => {
    const userId = '00000000-0000-4000-8000-000000000012'
    const billing = await createFreeUser(userId)

    await expect(
      billing.reserveUsage({ userId, key: 'llm.tokens', units: 10_001 }),
    ).resolves.toBeNull()
    billing.close()
  })

  it('serializes concurrent reservations so they cannot overspend quota', async () => {
    const userId = '00000000-0000-4000-8000-000000000014'
    const billing = await createFreeUser(userId)

    const reservations = await Promise.all([
      billing.reserveUsage({ userId, key: 'llm.tokens', units: 6_000 }),
      billing.reserveUsage({ userId, key: 'llm.tokens', units: 6_000 }),
    ])

    expect(reservations.filter(Boolean)).toHaveLength(1)
    await expect(billing.getQuota({ userId, key: 'llm.tokens' })).resolves.toEqual({
      limit: 10_000,
      used: 0,
      remaining: 4_000,
    })
    billing.close()
  })

  it('releases a reservation idempotently so its units become available', async () => {
    const userId = '00000000-0000-4000-8000-000000000013'
    const billing = await createFreeUser(userId)
    const reservation = await billing.reserveUsage({ userId, key: 'llm.tokens', units: 10_000 })
    expect(reservation).not.toBeNull()
    if (!reservation) throw new Error('Expected usage reservation')

    await expect(billing.reserveUsage({ userId, key: 'llm.tokens', units: 1 })).resolves.toBeNull()
    await billing.releaseUsage({ reservationId: reservation.reservationId })
    await billing.releaseUsage({ reservationId: reservation.reservationId })
    await expect(
      billing.reserveUsage({ userId, key: 'llm.tokens', units: 10_000 }),
    ).resolves.not.toBeNull()
    billing.close()
  })
})
