import { randomBytes, randomUUID } from 'node:crypto'

import { createMiddleware } from 'hono/factory'

import type { GatewayEnvironment } from './types.js'

export function createRequestContextMiddleware(options?: {
  generateRequestId?: () => string
  generateTraceId?: () => string
  generateSpanId?: () => string
  now?: () => number
}) {
  return createMiddleware<GatewayEnvironment>(async (context, next) => {
    const userAgent = context.req.header('user-agent')
    const requestId = options?.generateRequestId?.() ?? randomUUID()
    const parentTraceId = parseTraceParent(context.req.header('traceparent'))
    const traceId = parentTraceId ?? options?.generateTraceId?.() ?? randomBytes(16).toString('hex')
    const spanId = options?.generateSpanId?.() ?? randomBytes(8).toString('hex')
    context.set('requestContext', {
      requestId,
      traceId,
      spanId,
      identity: null,
      client: userAgent ? { userAgent } : {},
      startedAt: options?.now?.() ?? Date.now(),
    })
    await next()
    context.header('x-request-id', requestId)
  })
}

const traceParentPattern = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i

function parseTraceParent(value: string | undefined): string | undefined {
  const traceId = value ? traceParentPattern.exec(value)?.[1]?.toLowerCase() : undefined
  return traceId && traceId !== '00000000000000000000000000000000' ? traceId : undefined
}
