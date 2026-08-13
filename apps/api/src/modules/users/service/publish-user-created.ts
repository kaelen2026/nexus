import { randomUUID } from 'node:crypto'

import type { EventBus } from '../../../shared/events/index.js'

export function createUserCreatedPublisher(options: {
  eventBus: EventBus
  generateEventId?: () => string
  now?: () => Date
}) {
  return (userId: string) =>
    options.eventBus.publish({
      eventId: options.generateEventId?.() ?? randomUUID(),
      type: 'users.user-created',
      occurredAt: (options.now?.() ?? new Date()).toISOString(),
      payload: { userId },
    })
}
