import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const authAccountStatus = pgEnum('auth_account_status', ['active', 'disabled'])
export const authAccountProvider = pgEnum('auth_account_provider', [
  'phone',
  'email',
  'google',
  'apple',
])

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    provider: authAccountProvider().notNull(),
    providerSubject: text('provider_subject').notNull(),
    status: authAccountStatus().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('auth_accounts_provider_subject_unique').on(table.provider, table.providerSubject),
    index('auth_accounts_user_id_idx').on(table.userId),
  ],
)

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => authAccounts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('auth_sessions_user_id_idx').on(table.userId)],
)

export const authRefreshTokens = pgTable(
  'auth_refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => authSessions.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('auth_refresh_tokens_session_id_idx').on(table.sessionId)],
)
