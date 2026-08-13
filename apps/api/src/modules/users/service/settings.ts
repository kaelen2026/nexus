import type { DatabaseClient } from '@nexus/database'

import { UserNotFoundError } from '../errors.js'
import { findSettings, updateSettingsRecord } from '../repo/settings.repo.js'
import type { UpdateSettingsInput, UserSettings } from '../types.js'

export async function getSettings(database: DatabaseClient, userId: string): Promise<UserSettings> {
  const settings = await findSettings(database, userId)
  if (!settings) throw new UserNotFoundError()
  return settings
}

export async function updateSettings(
  database: DatabaseClient,
  input: UpdateSettingsInput,
): Promise<UserSettings> {
  const settings = await updateSettingsRecord(database, input)
  if (!settings) throw new UserNotFoundError()
  return settings
}
