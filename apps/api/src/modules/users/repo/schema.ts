import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'deleted'])

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  status: userStatus().notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usersUserCreatedOutbox = pgTable('users_user_created_outbox', {
  eventId: uuid('event_id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
})
