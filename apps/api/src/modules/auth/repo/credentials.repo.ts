import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { and, eq } from 'drizzle-orm'

import { authAccounts, authCredentials } from './schema.js'

export async function findEmailPassword(database: DatabaseClient, email: string) {
  const [result] = await database
    .select({
      accountId: authAccounts.id,
      userId: authAccounts.userId,
      passwordHash: authCredentials.passwordHash,
    })
    .from(authAccounts)
    .innerJoin(authCredentials, eq(authCredentials.accountId, authAccounts.id))
    .where(and(eq(authAccounts.provider, 'email'), eq(authAccounts.providerSubject, email)))
    .limit(1)
  return result
}

export async function upsertPasswordCredential(
  transaction: DatabaseTransaction,
  input: { accountId: string; passwordHash: string },
) {
  await transaction
    .insert(authCredentials)
    .values(input)
    .onConflictDoUpdate({
      target: authCredentials.accountId,
      set: { passwordHash: input.passwordHash, updatedAt: new Date() },
    })
}
