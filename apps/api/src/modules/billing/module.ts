import type { DatabaseClient } from '@nexus/database'

import { type EventBus, isUserCreatedEvent } from '../../shared/events/index.js'
import { assignFreePlan } from './service/assign-free-plan.js'
import { getEntitlement, getQuota } from './service/get-access-policy.js'
import { commitUsage, releaseUsage, reserveUsage } from './service/usage.js'

export function createBillingModule(options: { database: DatabaseClient; eventBus: EventBus }) {
  const unsubscribe = options.eventBus.subscribe('users.user-created', async (event) => {
    if (!isUserCreatedEvent(event)) throw new Error('Invalid users.user-created event')
    await assignFreePlan(options.database, {
      eventId: event.eventId,
      userId: event.payload.userId,
    })
  })
  return {
    getEntitlement: (input: { userId: string; key: string }) =>
      getEntitlement(options.database, input),
    getQuota: (input: { userId: string; key: string }) => getQuota(options.database, input),
    reserveUsage: (input: { userId: string; key: string; units: number }) =>
      reserveUsage(options.database, input),
    commitUsage: (input: { reservationId: string; actualUnits: number }) =>
      commitUsage(options.database, input),
    releaseUsage: (input: { reservationId: string }) => releaseUsage(options.database, input),
    close: unsubscribe,
  }
}
