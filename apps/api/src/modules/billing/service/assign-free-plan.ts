import type { DatabaseClient } from '@nexus/database'

import {
  billingEventReceipts,
  billingPlanEntitlements,
  billingPlanQuotas,
  billingPlans,
  billingSubscriptions,
} from '../repo/schema.js'

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
      .insert(billingPlanEntitlements)
      .values({ planId: plan.id, key: 'llm.generate', enabled: true })
      .onConflictDoUpdate({
        target: [billingPlanEntitlements.planId, billingPlanEntitlements.key],
        set: { enabled: true },
      })
    await transaction
      .insert(billingPlanQuotas)
      .values({ planId: plan.id, key: 'llm.tokens', limit: 10_000 })
      .onConflictDoUpdate({
        target: [billingPlanQuotas.planId, billingPlanQuotas.key],
        set: { limit: 10_000 },
      })

    await transaction
      .insert(billingSubscriptions)
      .values({ userId: input.userId, planId: plan.id })
      .onConflictDoNothing({ target: billingSubscriptions.userId })
  })
}
