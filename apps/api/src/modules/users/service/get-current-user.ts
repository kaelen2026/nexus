import type { DatabaseClient } from '@nexus/database'

import { UserNotFoundError, UserSuspendedError } from '../errors.js'
import { findUserById } from '../repo/users.repo.js'
import type { UserSummary } from '../types.js'

export async function getCurrentUser(
  database: DatabaseClient,
  userId: string,
): Promise<UserSummary> {
  const user = await findUserById(database, userId)
  if (!user || user.status === 'deleted') throw new UserNotFoundError()
  if (user.status === 'suspended') throw new UserSuspendedError()
  return user
}
