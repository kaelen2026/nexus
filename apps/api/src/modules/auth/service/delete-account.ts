import type { DatabaseClient } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { deleteUser } from '../../users/index.js'
import { authAccounts } from '../repo/schema.js'
import { revokeAllSessions } from './logout.js'

export async function deleteAccount(
  database: DatabaseClient,
  input: { userId: string },
): Promise<void> {
  await revokeAllSessions(database, input.userId)
  await database
    .update(authAccounts)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(eq(authAccounts.userId, input.userId))
  await deleteUser(database, input.userId)
}
