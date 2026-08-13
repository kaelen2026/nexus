import type { DatabaseClient } from '@nexus/database'
import type { EventBus } from '../../../shared/events/index.js'
import {
  findPendingUserCreatedEvents,
  markUserCreatedPublished,
} from '../repo/user-created-outbox.repo.js'

export function createUserCreatedPublisher(options: {
  database: DatabaseClient
  eventBus: EventBus
}) {
  return async (userId?: string) => {
    const events = await findPendingUserCreatedEvents(options.database, userId)
    for (const event of events) {
      await options.eventBus.publish({
        eventId: event.eventId,
        type: 'users.user-created',
        occurredAt: event.occurredAt.toISOString(),
        payload: { userId: event.userId },
      })
      await markUserCreatedPublished(options.database, event.eventId)
    }
  }
}
