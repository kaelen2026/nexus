import type { DatabaseClient } from '@nexus/database'

import { UserNotFoundError } from '../errors.js'
import { findProfile, updateProfileRecord } from '../repo/profiles.repo.js'
import type { UpdateProfileInput, UserProfile } from '../types.js'

export async function getProfile(database: DatabaseClient, userId: string): Promise<UserProfile> {
  const profile = await findProfile(database, userId)
  if (!profile) throw new UserNotFoundError()
  return profile
}

export async function updateProfile(
  database: DatabaseClient,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const profile = await updateProfileRecord(database, input)
  if (!profile) throw new UserNotFoundError()
  return profile
}
