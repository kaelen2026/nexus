import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import {
  createHttpObservabilityMiddleware,
  createInMemoryHttpMetrics,
  createRequestContextMiddleware,
  type GatewayEnvironment,
  type ObservabilitySink,
} from '../../src/gateway/index.js'

function createSink(): ObservabilitySink {
  return {
    log: vi.fn(),
    recordSpan: vi.fn(),
  }
}

describe('HTTP observability gateway', () => {
  it('correlates a completed request across structured logs, metrics, and traces', async () => {
    const sink = createSink()
    const metrics = createInMemoryHttpMetrics()
    const app = new Hono<GatewayEnvironment>()
    app.use(
      '*',
      createRequestContextMiddleware({
        generateRequestId: () => 'request-id',
        generateSpanId: () => '0123456789abcdef',
        generateTraceId: () => '0123456789abcdef0123456789abcdef',
        now: () => 100,
      }),
    )
    app.use('*', createHttpObservabilityMiddleware({ sink, metrics, now: () => 125 }))
    app.get('/probe/:id', (context) => context.json({ ok: true }))

    const response = await app.request('/probe/secret-value?token=must-not-appear', {
      headers: { authorization: 'Bearer must-not-appear' },
    })

    expect(response.headers.get('traceparent')).toBe(
      '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    )
    expect(sink.log).toHaveBeenCalledWith({
      event: 'http.request.completed',
      durationMs: 25,
      method: 'GET',
      requestId: 'request-id',
      route: '/probe/:id',
      spanId: '0123456789abcdef',
      statusCode: 200,
      traceId: '0123456789abcdef0123456789abcdef',
    })
    expect(sink.recordSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 25,
        name: 'GET /probe/:id',
        requestId: 'request-id',
        status: 'ok',
      }),
    )
    expect(metrics.render()).toContain(
      'nexus_http_requests_total{method="GET",route="/probe/:id",status="200"} 1',
    )
    expect(JSON.stringify(vi.mocked(sink.log).mock.calls)).not.toContain('secret-value')
    expect(JSON.stringify(vi.mocked(sink.log).mock.calls)).not.toContain('must-not-appear')
  })

  it('continues an incoming W3C trace and records failed requests without leaking errors', async () => {
    const sink = createSink()
    const app = new Hono<GatewayEnvironment>()
    app.onError(() => new Response('Internal Server Error', { status: 500 }))
    app.use(
      '*',
      createRequestContextMiddleware({
        generateRequestId: () => 'request-id',
        generateSpanId: () => 'aaaaaaaaaaaaaaaa',
        now: () => 10,
      }),
    )
    app.use('*', createHttpObservabilityMiddleware({ sink, now: () => 15 }))
    app.get('/failure', () => {
      throw new Error('database password is secret')
    })

    const response = await app.request('/failure', {
      headers: {
        traceparent: '00-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-cccccccccccccccc-01',
      },
    })

    expect(response.status).toBe(500)
    expect(sink.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http.request.failed',
        statusCode: 500,
        traceId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    )
    expect(JSON.stringify(vi.mocked(sink.log).mock.calls)).not.toContain('database password')
    expect(sink.recordSpan).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }))
  })
})
