import { describe, expect, it } from 'vitest'

import { createApp } from '../../src/app.js'
import { createInMemoryHttpMetrics } from '../../src/gateway/index.js'

describe('GET /metrics', () => {
  it('exports Prometheus HTTP metrics when a registry is configured', async () => {
    const metrics = createInMemoryHttpMetrics()
    const app = createApp({ metrics })

    await app.request('/health')
    const response = await app.request('/metrics')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toContain(
      'nexus_http_requests_total{method="GET",route="/health",status="200"} 1',
    )
  })
})
