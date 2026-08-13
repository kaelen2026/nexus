import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { userProfiles } from './schema.js'

export async function insertProfile(transaction: DatabaseTransaction, userId: string) {
  await transaction.insert(userProfiles).values({ userId })
}

export async function findProfile(database: DatabaseClient, userId: string) {
  const [profile] = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)
  return profile
}

export async function updateProfileRecord(
  database: DatabaseClient,
  input: { userId: string; displayName?: string | null; avatarUrl?: string | null },
) {
  const [profile] = await database
    .update(userProfiles)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, input.userId))
    .returning()
  return profile
}
