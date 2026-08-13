import type { DatabaseClient } from '@nexus/database'

import type { EventBus } from '../../shared/events/index.js'
import { getCurrentUser } from './service/get-current-user.js'
import { createUserCreatedPublisher } from './service/publish-user-created.js'

export function createUsersModule(options: { database: DatabaseClient; eventBus: EventBus }) {
  return {
    getCurrentUser: (userId: string) => getCurrentUser(options.database, userId),
    publishUserCreated: createUserCreatedPublisher({ eventBus: options.eventBus }),
  }
}
