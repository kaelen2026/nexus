import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'

const identity = {
  type: 'user' as const,
  subject: 'user-id',
  accountId: 'account-id',
  sessionId: 'session-id',
  roles: [],
  scopes: [],
}

describe('Auth logout routes', () => {
  it('revokes the current Session and clears web cookies', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      logout,
      trustedOrigins: ['https://app.nexus.test'],
    })

    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: '__Host-nexus_access=access-token',
        origin: 'https://app.nexus.test',
      },
    })

    expect(response.status).toBe(204)
    expect(logout).toHaveBeenCalledWith({ sessionId: 'session-id' })
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^__Host-nexus_access=;.*Max-Age=0/),
        expect.stringMatching(/^__Secure-nexus_refresh=;.*Max-Age=0/),
      ]),
    )
  })

  it('revokes every Session owned by the current User', async () => {
    const logoutAll = vi.fn().mockResolvedValue(undefined)
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      logoutAll,
    })

    const response = await app.request('/auth/logout-all', {
      method: 'POST',
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(204)
    expect(logoutAll).toHaveBeenCalledWith({ userId: 'user-id' })
  })

  it('rejects logout without an authenticated user Session', async () => {
    const logout = vi.fn()
    const app = createApp({ logout })

    const response = await app.request('/auth/logout', { method: 'POST' })

    expect(response.status).toBe(401)
    expect(logout).not.toHaveBeenCalled()
  })
})
