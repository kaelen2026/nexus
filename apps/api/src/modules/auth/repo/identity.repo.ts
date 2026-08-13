import type { DatabaseTransaction } from '@nexus/database'
import { and, eq } from 'drizzle-orm'

import { authAccounts, authSessions } from './schema.js'

export async function findPhoneAccount(transaction: DatabaseTransaction, phoneNumber: string) {
  const [account] = await transaction
    .select({ id: authAccounts.id, userId: authAccounts.userId })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, 'phone'), eq(authAccounts.providerSubject, phoneNumber)))
    .limit(1)
  return account
}

export async function insertPhoneAccount(
  transaction: DatabaseTransaction,
  input: { userId: string; phoneNumber: string },
) {
  const [account] = await transaction
    .insert(authAccounts)
    .values({ userId: input.userId, provider: 'phone', providerSubject: input.phoneNumber })
    .returning({ id: authAccounts.id })
  if (!account) throw new Error('Failed to create Account')
  return account
}

export async function insertSession(
  transaction: DatabaseTransaction,
  input: { userId: string; accountId: string; expiresAt: Date },
) {
  const [session] = await transaction
    .insert(authSessions)
    .values({
      userId: input.userId,
      accountId: input.accountId,
      expiresAt: input.expiresAt,
    })
    .returning({ id: authSessions.id })
  if (!session) throw new Error('Failed to create Session')
  return session
}
