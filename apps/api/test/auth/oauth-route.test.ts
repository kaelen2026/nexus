import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { InvalidOAuthCallbackError } from '../../src/modules/auth/index.js'

describe('OAuth routes', () => {
  it('redirects a supported provider to its authorization URL', async () => {
    const startOAuth = vi.fn().mockResolvedValue('https://accounts.example/authorize?state=state')
    const app = createApp({
      startOAuth,
      completeOAuth: vi.fn(),
      authWebUrl: 'https://app.nexus.test',
    })

    const response = await app.request('/auth/oauth/google')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://accounts.example/authorize?state=state')
    expect(startOAuth).toHaveBeenCalledWith({ provider: 'google' })
  })

  it('accepts Apple form_post callbacks, sets the session cookies, and returns to the app', async () => {
    const completeOAuth = vi.fn().mockResolvedValue({
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date('2026-08-13T00:15:00.000Z'),
      refreshToken: 'refresh-token',
    })
    const app = createApp({
      startOAuth: vi.fn(),
      completeOAuth,
      authWebUrl: 'https://app.nexus.test',
    })

    const response = await app.request('/auth/oauth/apple/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'code=authorization-code&state=oauth-state',
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://app.nexus.test/')
    expect(completeOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      code: 'authorization-code',
      state: 'oauth-state',
    })
    expect(response.headers.getSetCookie()).toHaveLength(2)
  })

  it('returns to login with a stable error when the callback is invalid', async () => {
    const app = createApp({
      startOAuth: vi.fn(),
      completeOAuth: vi.fn().mockRejectedValue(new InvalidOAuthCallbackError()),
      authWebUrl: 'https://app.nexus.test',
    })

    const response = await app.request('/auth/oauth/google/callback?code=bad-code&state=bad-state')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://app.nexus.test/login?error=oauth_failed')
  })
})
