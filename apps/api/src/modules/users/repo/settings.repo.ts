import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { userSettings } from './schema.js'

export async function insertSettings(transaction: DatabaseTransaction, userId: string) {
  await transaction.insert(userSettings).values({ userId })
}

export async function findSettings(database: DatabaseClient, userId: string) {
  const [settings] = await database
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)
  return settings
}

export async function updateSettingsRecord(
  database: DatabaseClient,
  input: { userId: string; locale?: string; timezone?: string },
) {
  const [settings] = await database
    .update(userSettings)
    .set({
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, input.userId))
    .returning()
  return settings
}
