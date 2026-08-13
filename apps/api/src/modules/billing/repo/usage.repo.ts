import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { and, eq, sql } from 'drizzle-orm'

import { billingUsageRecords, billingUsageReservations } from './schema.js'

type DatabaseExecutor = DatabaseClient | DatabaseTransaction

export async function lockUsagePolicy(
  database: DatabaseExecutor,
  input: { userId: string; key: string },
): Promise<void> {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${input.userId}:${input.key}`}, 0))`,
  )
}

export async function getUsageTotals(
  database: DatabaseExecutor,
  input: { userId: string; key: string },
): Promise<{ used: number; reserved: number }> {
  const [result] = await database.execute<{ used: number; reserved: number }>(sql`
    select
      coalesce((
        select sum(units)::int
        from billing_usage_records
        where user_id = ${input.userId} and key = ${input.key}
      ), 0)::int as used,
      coalesce((
        select sum(reserved_units)::int
        from billing_usage_reservations
        where user_id = ${input.userId}
          and key = ${input.key}
          and status = 'reserved'
      ), 0)::int as reserved
  `)
  return result ?? { used: 0, reserved: 0 }
}

export async function createUsageReservation(
  database: DatabaseExecutor,
  input: { userId: string; key: string; units: number },
): Promise<{ reservationId: string }> {
  const [reservation] = await database
    .insert(billingUsageReservations)
    .values({ userId: input.userId, key: input.key, reservedUnits: input.units })
    .returning({ reservationId: billingUsageReservations.id })
  if (!reservation) throw new Error('Failed to create usage reservation')
  return reservation
}

export async function findUsageReservationForUpdate(
  database: DatabaseTransaction,
  reservationId: string,
): Promise<{
  reservationId: string
  userId: string
  key: string
  reservedUnits: number
  actualUnits: number | null
  status: 'reserved' | 'committed' | 'released'
} | null> {
  const [reservation] = await database
    .select({
      reservationId: billingUsageReservations.id,
      userId: billingUsageReservations.userId,
      key: billingUsageReservations.key,
      reservedUnits: billingUsageReservations.reservedUnits,
      actualUnits: billingUsageReservations.actualUnits,
      status: billingUsageReservations.status,
    })
    .from(billingUsageReservations)
    .where(eq(billingUsageReservations.id, reservationId))
    .for('update')
    .limit(1)
  return reservation ?? null
}

export async function commitUsageReservation(
  database: DatabaseTransaction,
  input: { reservationId: string; userId: string; key: string; actualUnits: number },
): Promise<void> {
  await database
    .update(billingUsageReservations)
    .set({ status: 'committed', actualUnits: input.actualUnits, finalizedAt: new Date() })
    .where(
      and(
        eq(billingUsageReservations.id, input.reservationId),
        eq(billingUsageReservations.status, 'reserved'),
      ),
    )
  await database
    .insert(billingUsageRecords)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      key: input.key,
      units: input.actualUnits,
    })
    .onConflictDoNothing({ target: billingUsageRecords.reservationId })
}

export async function releaseUsageReservation(
  database: DatabaseClient,
  reservationId: string,
): Promise<void> {
  await database
    .update(billingUsageReservations)
    .set({ status: 'released', finalizedAt: new Date() })
    .where(
      and(
        eq(billingUsageReservations.id, reservationId),
        eq(billingUsageReservations.status, 'reserved'),
      ),
    )
}
