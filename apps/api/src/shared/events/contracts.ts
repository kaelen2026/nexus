import type { EventEnvelope } from './types.js'

export type UserCreatedEvent = EventEnvelope<'users.user-created', { userId: string }>

export function isUserCreatedEvent(event: EventEnvelope): event is UserCreatedEvent {
  if (event.type !== 'users.user-created') return false
  if (!event.payload || typeof event.payload !== 'object') return false
  return typeof (event.payload as { userId?: unknown }).userId === 'string'
}
