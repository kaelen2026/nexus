import type { DatabaseClient } from '@nexus/database'

import { markUserDeleted } from '../repo/users.repo.js'

export async function deleteUser(database: DatabaseClient, userId: string): Promise<void> {
  await markUserDeleted(database, userId)
}
