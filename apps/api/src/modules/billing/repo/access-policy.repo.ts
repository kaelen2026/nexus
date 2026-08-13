import type { DatabaseClient } from '@nexus/database'
import { and, eq } from 'drizzle-orm'

import { billingPlanEntitlements, billingPlanQuotas, billingSubscriptions } from './schema.js'

export async function findActiveEntitlement(
  database: DatabaseClient,
  input: { userId: string; key: string },
): Promise<boolean | null> {
  const [entitlement] = await database
    .select({ enabled: billingPlanEntitlements.enabled })
    .from(billingSubscriptions)
    .innerJoin(
      billingPlanEntitlements,
      eq(billingPlanEntitlements.planId, billingSubscriptions.planId),
    )
    .where(
      and(
        eq(billingSubscriptions.userId, input.userId),
        eq(billingSubscriptions.status, 'active'),
        eq(billingPlanEntitlements.key, input.key),
      ),
    )
    .limit(1)
  return entitlement?.enabled ?? null
}

export async function findActiveQuotaLimit(
  database: DatabaseClient,
  input: { userId: string; key: string },
): Promise<number | null> {
  const [quota] = await database
    .select({ limit: billingPlanQuotas.limit })
    .from(billingSubscriptions)
    .innerJoin(billingPlanQuotas, eq(billingPlanQuotas.planId, billingSubscriptions.planId))
    .where(
      and(
        eq(billingSubscriptions.userId, input.userId),
        eq(billingSubscriptions.status, 'active'),
        eq(billingPlanQuotas.key, input.key),
      ),
    )
    .limit(1)
  return quota?.limit ?? null
}
