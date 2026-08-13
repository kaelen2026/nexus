import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const billingSubscriptionStatus = pgEnum('billing_subscription_status', ['active', 'ended'])

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

export const billingEventReceipts = pgTable('billing_event_receipts', {
  eventId: text('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})
