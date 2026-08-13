import type { EventBus, EventEnvelope } from './types.js'

export function createInMemoryEventBus(): EventBus {
  const handlers = new Map<string, Set<(event: EventEnvelope) => Promise<void>>>()

  return {
    async publish(event) {
      for (const handler of handlers.get(event.type) ?? []) await handler(event)
    },
    subscribe(type, handler) {
      const subscribers = handlers.get(type) ?? new Set()
      subscribers.add(handler)
      handlers.set(type, subscribers)
      return () => subscribers.delete(handler)
    },
  }
}
