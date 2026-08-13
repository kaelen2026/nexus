import type { DatabaseClient } from '@nexus/database'

import { createUser } from '../../users/index.js'
import { findAccount, insertAccount, insertSession } from '../repo/identity.repo.js'
import { normalizeEmail } from './email.js'

export async function createEmailIdentity(
  database: DatabaseClient,
  input: { email: string; sessionExpiresAt: Date },
  options?: { publishUserCreated?: (userId: string) => Promise<void> },
): Promise<{ userId: string; accountId: string; sessionId: string }> {
  const email = normalizeEmail(input.email)
  const { userCreated, ...identity } = await database.transaction(async (transaction) => {
    const existingAccount = await findAccount(transaction, 'email', email)
    let userId = existingAccount?.userId
    let accountId = existingAccount?.id
    let userCreated = false

    if (!userId || !accountId) {
      const user = await createUser(transaction)
      const account = await insertAccount(transaction, {
        userId: user.userId,
        provider: 'email',
        providerSubject: email,
      })
      userId = user.userId
      accountId = account.id
      userCreated = true
    }

    const session = await insertSession(transaction, {
      userId,
      accountId,
      expiresAt: input.sessionExpiresAt,
    })
    return { userId, accountId, sessionId: session.id, userCreated }
  })
  if (userCreated) await options?.publishUserCreated?.(identity.userId)
  return identity
}
