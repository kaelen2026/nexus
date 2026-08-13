import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const billingSubscriptionStatus = pgEnum('billing_subscription_status', ['active', 'ended'])
export const billingUsageReservationStatus = pgEnum('billing_usage_reservation_status', [
  'reserved',
  'committed',
  'released',
])

export const billingPlans = pgTable('billing_plans', {
  id: uuid().defaultRandom().primaryKey(),
  key: text().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => billingPlans.id),
    status: billingSubscriptionStatus().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('billing_subscriptions_user_id_unique').on(table.userId)],
)

export const billingPlanEntitlements = pgTable(
  'billing_plan_entitlements',
  {
    id: uuid().defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => billingPlans.id),
    key: text().notNull(),
    enabled: boolean().notNull(),
  },
  (table) => [unique('billing_plan_entitlements_plan_key_unique').on(table.planId, table.key)],
)

export const billingPlanQuotas = pgTable(
  'billing_plan_quotas',
  {
    id: uuid().defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => billingPlans.id),
    key: text().notNull(),
    limit: integer().notNull(),
  },
  (table) => [
    unique('billing_plan_quotas_plan_key_unique').on(table.planId, table.key),
    check('billing_plan_quotas_limit_positive', sql`${table.limit} > 0`),
  ],
)

export const billingEventReceipts = pgTable('billing_event_receipts', {
  eventId: text('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const billingUsageReservations = pgTable(
  'billing_usage_reservations',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    key: text().notNull(),
    reservedUnits: integer('reserved_units').notNull(),
    actualUnits: integer('actual_units'),
    status: billingUsageReservationStatus().notNull().default('reserved'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => [
    check('billing_usage_reservations_reserved_units_positive', sql`${table.reservedUnits} > 0`),
    check(
      'billing_usage_reservations_actual_units_non_negative',
      sql`${table.actualUnits} is null or ${table.actualUnits} >= 0`,
    ),
  ],
)

export const billingUsageRecords = pgTable(
  'billing_usage_records',
  {
    id: uuid().defaultRandom().primaryKey(),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => billingUsageReservations.id)
      .unique(),
    userId: uuid('user_id').notNull(),
    key: text().notNull(),
    units: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('billing_usage_records_units_non_negative', sql`${table.units} >= 0`)],
)
