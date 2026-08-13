import type { DatabaseClient } from '@nexus/database'

import type { EventBus } from '../../shared/events/index.js'
import { getCurrentUser } from './service/get-current-user.js'
import { createUserCreatedPublisher } from './service/publish-user-created.js'

export function createUsersModule(options: { database: DatabaseClient; eventBus: EventBus }) {
  const publishPendingEvents = createUserCreatedPublisher(options)
  return {
    getCurrentUser: (userId: string) => getCurrentUser(options.database, userId),
    publishUserCreated: (userId: string) => publishPendingEvents(userId),
    replayPendingEvents: () => publishPendingEvents(),
  }
}
