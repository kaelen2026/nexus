import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'

describe('email OTP routes', () => {
  it('accepts an email OTP request', async () => {
    const sendEmailOtp = vi.fn().mockResolvedValue({
      expiresAt: new Date('2026-08-13T00:05:00.000Z'),
    })
    const app = createApp({ sendEmailOtp })

    const response = await app.request('/auth/email/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    })

    expect(response.status).toBe(202)
    expect(sendEmailOtp).toHaveBeenCalledWith({ email: 'alice@example.com' })
  })

  it('rejects an invalid email before calling the service', async () => {
    const sendEmailOtp = vi.fn()
    const app = createApp({ sendEmailOtp })

    const response = await app.request('/auth/email/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })

    expect(response.status).toBe(400)
    expect(sendEmailOtp).not.toHaveBeenCalled()
  })

  it('verifies an email OTP and returns a token pair', async () => {
    const verifyEmailOtp = vi.fn().mockResolvedValue({
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date('2026-08-13T00:15:00.000Z'),
      refreshToken: 'refresh-token',
    })
    const app = createApp({ verifyEmailOtp })
    const response = await app.request('/auth/email/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', otp: '123456' }),
    })

    expect(response.status).toBe(200)
    expect(verifyEmailOtp).toHaveBeenCalledWith({ email: 'alice@example.com', otp: '123456' })
  })
})
