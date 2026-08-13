import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { users } from './schema.js'

export async function insertUser(transaction: DatabaseTransaction): Promise<{ id: string }> {
  const [user] = await transaction.insert(users).values({}).returning({ id: users.id })
  if (!user) throw new Error('Failed to create User')
  return user
}

export async function findUserById(database: DatabaseClient, userId: string) {
  const [user] = await database
    .select({
      id: users.id,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return user
}
