import type { DatabaseClient } from '@nexus/database'

import { findActiveEntitlement, findActiveQuotaLimit } from '../repo/access-policy.repo.js'
import { getUsageTotals } from '../repo/usage.repo.js'

export async function getEntitlement(
  database: DatabaseClient,
  input: { userId: string; key: string },
): Promise<boolean> {
  return (await findActiveEntitlement(database, input)) ?? false
}

export async function getQuota(
  database: DatabaseClient,
  input: { userId: string; key: string },
): Promise<{ limit: number; used: number; remaining: number } | null> {
  const limit = await findActiveQuotaLimit(database, input)
  if (limit === null) return null
  const totals = await getUsageTotals(database, input)
  return {
    limit,
    used: totals.used,
    remaining: Math.max(0, limit - totals.used - totals.reserved),
  }
}
