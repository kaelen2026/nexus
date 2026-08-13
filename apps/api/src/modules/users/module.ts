import type { DatabaseClient } from '@nexus/database'

import { getCurrentUser } from './service/get-current-user.js'

export function createUsersModule(database: DatabaseClient) {
  return {
    getCurrentUser: (userId: string) => getCurrentUser(database, userId),
  }
}
