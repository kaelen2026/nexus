import type { DatabaseClient } from '@nexus/database'

import { createUser } from '../../users/index.js'
import { AccountDisabledError } from '../errors.js'
import {
  findAccount,
  findOAuthAccount,
  insertOAuthAccount,
  insertSession,
} from '../repo/identity.repo.js'
import type { OAuthProviderId } from '../types.js'
import { normalizeEmail } from './email.js'

export async function createOAuthIdentity(
  database: DatabaseClient,
  input: {
    provider: OAuthProviderId
    providerSubject: string
    verifiedEmail?: string
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
    if (existingAccount?.status === 'disabled') throw new AccountDisabledError()
    let userId = existingAccount?.userId
    let accountId = existingAccount?.id
    let userCreated = false

    if (!userId || !accountId) {
      const emailAccount = input.verifiedEmail
        ? await findAccount(transaction, 'email', normalizeEmail(input.verifiedEmail))
        : undefined
      if (emailAccount?.status === 'disabled') throw new AccountDisabledError()
      const user = emailAccount ? undefined : await createUser(transaction)
      const linkedUserId = emailAccount?.userId ?? user?.userId
      if (!linkedUserId) throw new Error('Failed to resolve User')
      const account = await insertOAuthAccount(transaction, {
        userId: linkedUserId,
        provider: input.provider,
        providerSubject: input.providerSubject,
      })
      userId = linkedUserId
      accountId = account.id
      userCreated = Boolean(user)
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
