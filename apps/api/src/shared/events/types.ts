export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  eventId: string
  type: TType
  occurredAt: string
  correlationId?: string
  payload: TPayload
}

export interface EventBus {
  publish(event: EventEnvelope): Promise<void>
  subscribe(type: string, handler: (event: EventEnvelope) => Promise<void>): () => void
}
