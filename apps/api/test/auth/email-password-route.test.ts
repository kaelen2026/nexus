import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { InvalidCredentialsError } from '../../src/modules/auth/index.js'

describe('email password routes', () => {
  it('logs in with a cookie session', async () => {
    const loginWithEmailPassword = vi.fn().mockResolvedValue({
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date('2026-08-13T00:15:00.000Z'),
      refreshToken: 'refresh-token',
    })
    const app = createApp({ loginWithEmailPassword })
    const response = await app.request('/auth/email/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'correct horse battery staple',
        sessionMode: 'cookie',
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessionMode: 'cookie',
      accessTokenExpiresAt: '2026-08-13T00:15:00.000Z',
    })
  })

  it('maps every failed login to the same response', async () => {
    const app = createApp({
      loginWithEmailPassword: vi.fn().mockRejectedValue(new InvalidCredentialsError()),
    })
    const response = await app.request('/auth/email/password/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'incorrect password',
      }),
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    })
  })

  it('resets a password using an email OTP without logging in', async () => {
    const resetEmailPassword = vi.fn().mockResolvedValue(undefined)
    const app = createApp({ resetEmailPassword })
    const response = await app.request('/auth/email/password/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        otp: '123456',
        newPassword: 'correct horse battery staple',
      }),
    })
    expect(response.status).toBe(204)
  })
})
