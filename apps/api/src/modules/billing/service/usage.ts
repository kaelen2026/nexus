import type { DatabaseClient } from '@nexus/database'

import { findActiveQuotaLimit } from '../repo/access-policy.repo.js'
import {
  commitUsageReservation,
  createUsageReservation,
  findUsageReservationForUpdate,
  getUsageTotals,
  lockUsagePolicy,
  releaseUsageReservation,
} from '../repo/usage.repo.js'

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
}

export async function reserveUsage(
  database: DatabaseClient,
  input: { userId: string; key: string; units: number },
): Promise<{ reservationId: string } | null> {
  requirePositiveInteger(input.units, 'units')
  return database.transaction(async (transaction) => {
    await lockUsagePolicy(transaction, input)
    const limit = await findActiveQuotaLimit(transaction, input)
    if (limit === null) return null
    const totals = await getUsageTotals(transaction, input)
    if (totals.used + totals.reserved + input.units > limit) return null
    return createUsageReservation(transaction, input)
  })
}

export async function commitUsage(
  database: DatabaseClient,
  input: { reservationId: string; actualUnits: number },
): Promise<void> {
  if (!Number.isInteger(input.actualUnits) || input.actualUnits < 0) {
    throw new Error('actualUnits must be a non-negative integer')
  }
  await database.transaction(async (transaction) => {
    const reservation = await findUsageReservationForUpdate(transaction, input.reservationId)
    if (!reservation) return
    if (reservation.status === 'committed') {
      if (reservation.actualUnits !== input.actualUnits) {
        throw new Error('Usage reservation was already committed with different units')
      }
      return
    }
    if (reservation.status === 'released') return
    await lockUsagePolicy(transaction, reservation)
    await commitUsageReservation(transaction, {
      reservationId: reservation.reservationId,
      userId: reservation.userId,
      key: reservation.key,
      actualUnits: input.actualUnits,
    })
  })
}

export async function releaseUsage(
  database: DatabaseClient,
  input: { reservationId: string },
): Promise<void> {
  await releaseUsageReservation(database, input.reservationId)
}
