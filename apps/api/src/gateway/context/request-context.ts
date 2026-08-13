import { randomUUID } from 'node:crypto'

import { createMiddleware } from 'hono/factory'

import type { GatewayEnvironment } from './types.js'

export function createRequestContextMiddleware(options?: {
  generateRequestId?: () => string
  now?: () => number
}) {
  return createMiddleware<GatewayEnvironment>(async (context, next) => {
    const userAgent = context.req.header('user-agent')
    const requestId = options?.generateRequestId?.() ?? randomUUID()
    context.set('requestContext', {
      requestId,
      identity: null,
      client: userAgent ? { userAgent } : {},
      startedAt: options?.now?.() ?? Date.now(),
    })
    await next()
    context.header('x-request-id', requestId)
  })
}
