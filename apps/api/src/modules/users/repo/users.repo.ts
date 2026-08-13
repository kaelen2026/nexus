import type { DatabaseTransaction } from '@nexus/database'

import { users } from './schema.js'

export async function insertUser(transaction: DatabaseTransaction): Promise<{ id: string }> {
  const [user] = await transaction.insert(users).values({}).returning({ id: users.id })
  if (!user) throw new Error('Failed to create User')
  return user
}
