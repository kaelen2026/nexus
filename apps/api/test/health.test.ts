import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('reports that the API is available', async () => {
    const response = await createApp().request('/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })
})
