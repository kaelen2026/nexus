import type { DatabaseTransaction } from '@nexus/database'
import { and, eq } from 'drizzle-orm'

import { authAccounts, authSessions } from './schema.js'

type OAuthProvider = 'google' | 'apple'

export async function findPhoneAccount(transaction: DatabaseTransaction, phoneNumber: string) {
  return findAccount(transaction, 'phone', phoneNumber)
}

export async function findAccount(
  transaction: DatabaseTransaction,
  provider: 'phone' | 'email',
  providerSubject: string,
) {
  const [account] = await transaction
    .select({ id: authAccounts.id, userId: authAccounts.userId, status: authAccounts.status })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.provider, provider), eq(authAccounts.providerSubject, providerSubject)),
    )
    .limit(1)
  return account
}

export async function insertPhoneAccount(
  transaction: DatabaseTransaction,
  input: { userId: string; phoneNumber: string },
) {
  return insertAccount(transaction, {
    userId: input.userId,
    provider: 'phone',
    providerSubject: input.phoneNumber,
  })
}

export async function insertAccount(
  transaction: DatabaseTransaction,
  input: { userId: string; provider: 'phone' | 'email'; providerSubject: string },
) {
  const [account] = await transaction
    .insert(authAccounts)
    .values(input)
    .returning({ id: authAccounts.id })
  if (!account) throw new Error('Failed to create Account')
  return account
}

export async function findOAuthAccount(
  transaction: DatabaseTransaction,
  provider: OAuthProvider,
  providerSubject: string,
) {
  const [account] = await transaction
    .select({ id: authAccounts.id, userId: authAccounts.userId, status: authAccounts.status })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.provider, provider), eq(authAccounts.providerSubject, providerSubject)),
    )
    .limit(1)
  return account
}

export async function insertOAuthAccount(
  transaction: DatabaseTransaction,
  input: { userId: string; provider: OAuthProvider; providerSubject: string },
) {
  const [account] = await transaction
    .insert(authAccounts)
    .values(input)
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
