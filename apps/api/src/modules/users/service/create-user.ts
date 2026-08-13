import type { DatabaseTransaction } from '@nexus/database'
import { enqueueUserCreated } from '../repo/user-created-outbox.repo.js'
import { insertUser } from '../repo/users.repo.js'

export async function createUser(transaction: DatabaseTransaction): Promise<{ userId: string }> {
  const user = await insertUser(transaction)
  await enqueueUserCreated(transaction, user.id)
  return { userId: user.id }
}
