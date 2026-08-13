import type { DatabaseClient } from '@nexus/database'

import { createUser } from '../../users/index.js'
import { findPhoneAccount, insertPhoneAccount, insertSession } from '../repo/identity.repo.js'
import { normalizePhoneNumber } from './phone-number.js'

interface CreatePhoneIdentityInput {
  phoneNumber: string
  sessionExpiresAt: Date
}

interface PhoneIdentity {
  userId: string
  accountId: string
  sessionId: string
}

export async function createPhoneIdentity(
  database: DatabaseClient,
  input: CreatePhoneIdentityInput,
  options?: { publishUserCreated?: (userId: string) => Promise<void> },
): Promise<PhoneIdentity> {
  const phoneNumber = normalizePhoneNumber(input.phoneNumber)

  const { userCreated, ...identity } = await database.transaction(async (transaction) => {
    const existingAccount = await findPhoneAccount(transaction, phoneNumber)
    let userId = existingAccount?.userId
    let accountId = existingAccount?.id

    let userCreated = false
    if (!userId || !accountId) {
      const user = await createUser(transaction)
      const account = await insertPhoneAccount(transaction, { userId: user.userId, phoneNumber })
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
