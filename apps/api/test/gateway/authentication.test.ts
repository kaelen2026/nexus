import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import {
  createAuthenticationMiddleware,
  createCorsMiddleware,
  createRequestContextMiddleware,
  type GatewayEnvironment,
} from '../../src/gateway/index.js'

function createTestApp(options: {
  authenticateAccessToken: (token: string) => Promise<{
    type: 'user'
    subject: string
    accountId: string
    sessionId: string
    roles: string[]
    scopes: string[]
  }>
  trustedOrigins?: string[]
}) {
  const app = new Hono<GatewayEnvironment>()
  app.use('*', createCorsMiddleware({ trustedOrigins: options.trustedOrigins ?? [] }))
  app.use(
    '*',
    createRequestContextMiddleware({
      generateRequestId: () => 'request-id',
      now: () => 123,
    }),
  )
  app.use('*', createAuthenticationMiddleware(options))
  app.all('/probe', (context) => context.json(context.get('requestContext')))
  return app
}

const identity = {
  type: 'user' as const,
  subject: 'user-id',
  accountId: 'account-id',
  sessionId: 'session-id',
  roles: [],
  scopes: [],
}

describe('authentication gateway', () => {
  it('allows credentialed browser requests only from a trusted CORS Origin', async () => {
    const app = createTestApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      trustedOrigins: ['https://app.nexus.example'],
    })

    const response = await app.request('/probe', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.nexus.example',
        'access-control-request-method': 'POST',
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.nexus.example')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })
  it('authenticates a Bearer access token into RequestContext identity', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue(identity)
    const app = createTestApp({ authenticateAccessToken })

    const response = await app.request('/probe', {
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('request-id')
    expect(authenticateAccessToken).toHaveBeenCalledWith('access-token')
    await expect(response.json()).resolves.toMatchObject({ requestId: 'request-id', identity })
  })

  it('authenticates an access cookie and accepts unsafe requests only from a trusted Origin', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue(identity)
    const app = createTestApp({
      authenticateAccessToken,
      trustedOrigins: ['https://app.nexus.example'],
    })

    const response = await app.request('/probe', {
      method: 'POST',
      headers: {
        cookie: '__Host-nexus_access=cookie-access-token',
        origin: 'https://app.nexus.example',
      },
    })

    expect(response.status).toBe(200)
    expect(authenticateAccessToken).toHaveBeenCalledWith('cookie-access-token')
  })

  it('rejects cookie-authenticated unsafe requests without a trusted Origin', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue(identity)
    const app = createTestApp({
      authenticateAccessToken,
      trustedOrigins: ['https://app.nexus.example'],
    })

    const response = await app.request('/probe', {
      method: 'POST',
      headers: { cookie: '__Host-nexus_access=cookie-access-token' },
    })

    expect(response.status).toBe(403)
    expect(authenticateAccessToken).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_ORIGIN', message: 'Invalid request origin' },
    })
  })

  it('does not apply browser CSRF checks to Bearer clients', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue(identity)
    const app = createTestApp({
      authenticateAccessToken,
      trustedOrigins: ['https://app.nexus.example'],
    })

    const response = await app.request('/probe', {
      method: 'POST',
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(200)
  })

  it('returns a non-disclosing 401 for an invalid access token', async () => {
    const authenticateAccessToken = vi.fn().mockRejectedValue(new Error('expired JWT'))
    const app = createTestApp({ authenticateAccessToken })

    const response = await app.request('/probe', {
      headers: { authorization: 'Bearer invalid-token' },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_ACCESS_TOKEN', message: 'Invalid access token' },
    })
  })

  it('does not misclassify downstream application errors as authentication failures', async () => {
    const authenticateAccessToken = vi.fn().mockResolvedValue(identity)
    const app = new Hono<GatewayEnvironment>()
    app.onError(() => new Response('Internal Server Error', { status: 500 }))
    app.use('*', createRequestContextMiddleware())
    app.use('*', createAuthenticationMiddleware({ authenticateAccessToken }))
    app.get('/failure', () => {
      throw new Error('application failure')
    })

    const response = await app.request('/failure', {
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(500)
  })
})
