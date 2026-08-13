import type { DatabaseClient } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { createUser } from '../../users/index.js'
import { InvalidCredentialsError } from '../errors.js'
import { findEmailPassword, upsertPasswordCredential } from '../repo/credentials.repo.js'
import { findAccount, insertAccount, insertSession } from '../repo/identity.repo.js'
import { authSessions } from '../repo/schema.js'
import { normalizeEmail } from './email.js'

const unknownPasswordHash =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export function createEmailPasswordLogin(dependencies: {
  database: DatabaseClient
  verify(password: string, passwordHash: string): Promise<boolean>
}) {
  return async (input: { email: string; password: string; sessionExpiresAt: Date }) => {
    const credential = await findEmailPassword(dependencies.database, normalizeEmail(input.email))
    const valid = await dependencies.verify(
      input.password,
      credential?.passwordHash ?? unknownPasswordHash,
    )
    if (!credential || !valid) throw new InvalidCredentialsError()

    const session = await dependencies.database.transaction((transaction) =>
      insertSession(transaction, {
        userId: credential.userId,
        accountId: credential.accountId,
        expiresAt: input.sessionExpiresAt,
      }),
    )
    return { userId: credential.userId, accountId: credential.accountId, sessionId: session.id }
  }
}

export function createResetEmailPassword(dependencies: {
  database: DatabaseClient
  consumeOtp(input: { email: string; otp: string }): Promise<void>
  hash(password: string): Promise<string>
  publishUserCreated?: (userId: string) => Promise<void>
}) {
  return async (input: { email: string; otp: string; newPassword: string }): Promise<void> => {
    await dependencies.consumeOtp({ email: input.email, otp: input.otp })
    const email = normalizeEmail(input.email)
    const passwordHash = await dependencies.hash(input.newPassword)
    const result = await dependencies.database.transaction(async (transaction) => {
      const existing = await findAccount(transaction, 'email', email)
      let userId = existing?.userId
      let accountId = existing?.id
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
      await upsertPasswordCredential(transaction, { accountId, passwordHash })
      await transaction
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.userId, userId))
      return { userId, userCreated }
    })
    if (result.userCreated) await dependencies.publishUserCreated?.(result.userId)
  }
}
