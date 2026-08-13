import type { DatabaseClient } from '@nexus/database'

import { billingEventReceipts, billingPlans, billingSubscriptions } from '../repo/schema.js'

export async function assignFreePlan(
  database: DatabaseClient,
  input: { eventId: string; userId: string },
): Promise<void> {
  await database.transaction(async (transaction) => {
    const [receipt] = await transaction
      .insert(billingEventReceipts)
      .values({ eventId: input.eventId, eventType: 'users.user-created' })
      .onConflictDoNothing()
      .returning({ eventId: billingEventReceipts.eventId })
    if (!receipt) return

    const [plan] = await transaction
      .insert(billingPlans)
      .values({ key: 'free' })
      .onConflictDoUpdate({ target: billingPlans.key, set: { key: 'free' } })
      .returning({ id: billingPlans.id })
    if (!plan) throw new Error('Failed to resolve free Billing Plan')

    await transaction
      .insert(billingSubscriptions)
      .values({ userId: input.userId, planId: plan.id })
      .onConflictDoNothing({ target: billingSubscriptions.userId })
  })
}
