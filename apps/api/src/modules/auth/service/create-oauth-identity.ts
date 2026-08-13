import type { DatabaseClient } from '@nexus/database'

import { createUser } from '../../users/index.js'
import { findOAuthAccount, insertOAuthAccount, insertSession } from '../repo/identity.repo.js'
import type { OAuthProviderId } from '../types.js'

export async function createOAuthIdentity(
  database: DatabaseClient,
  input: {
    provider: OAuthProviderId
    providerSubject: string
    sessionExpiresAt: Date
  },
  options?: { publishUserCreated?: (userId: string) => Promise<void> },
) {
  const { userCreated, ...identity } = await database.transaction(async (transaction) => {
    const existingAccount = await findOAuthAccount(
      transaction,
      input.provider,
      input.providerSubject,
    )
    let userId = existingAccount?.userId
    let accountId = existingAccount?.id
    let userCreated = false

    if (!userId || !accountId) {
      const user = await createUser(transaction)
      const account = await insertOAuthAccount(transaction, {
        userId: user.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
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
