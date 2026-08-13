import { createMiddleware } from 'hono/factory'

import type { GatewayEnvironment } from '../context/types.js'
import type { HttpMetrics, ObservabilitySink } from './types.js'

const noOpSink: ObservabilitySink = {
  log() {},
  recordSpan() {},
}

export function createHttpObservabilityMiddleware(options: {
  sink?: ObservabilitySink
  metrics?: HttpMetrics
  now?: () => number
}) {
  const sink = options.sink ?? noOpSink
  const now = options.now ?? Date.now

  return createMiddleware<GatewayEnvironment>(async (context, next) => {
    const request = context.get('requestContext')
    let failed = false
    try {
      await next()
    } catch (error) {
      failed = true
      observe(500)
      throw error
    }

    observe(context.res.status)

    function observe(statusCode: number) {
      const durationMs = Math.max(0, now() - request.startedAt)
      const route = context.req.routePath || 'unmatched'
      const identitySubject = context.get('requestContext').identity?.subject
      const common = {
        requestId: request.requestId,
        traceId: request.traceId,
        spanId: request.spanId,
        method: context.req.method,
        route,
        statusCode,
        durationMs,
        ...(identitySubject ? { identitySubject } : {}),
      }
      sink.log({
        event: failed || statusCode >= 500 ? 'http.request.failed' : 'http.request.completed',
        ...common,
      })
      sink.recordSpan({
        name: `${common.method} ${route}`,
        status: failed || statusCode >= 500 ? 'error' : 'ok',
        ...common,
      })
      options.metrics?.record(common)
      context.header('traceparent', `00-${request.traceId}-${request.spanId}-01`)
    }
  })
}
