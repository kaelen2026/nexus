import type { DatabaseTransaction } from '@nexus/database'
import { insertProfile } from '../repo/profiles.repo.js'
import { insertSettings } from '../repo/settings.repo.js'
import { enqueueUserCreated } from '../repo/user-created-outbox.repo.js'
import { insertUser } from '../repo/users.repo.js'

export async function createUser(transaction: DatabaseTransaction): Promise<{ userId: string }> {
  const user = await insertUser(transaction)
  await insertProfile(transaction, user.id)
  await insertSettings(transaction, user.id)
  await enqueueUserCreated(transaction, user.id)
  return { userId: user.id }
}
