import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { InvalidOtpError } from '../../src/modules/auth/index.js'

describe('POST /auth/otp/send', () => {
  it('accepts a phone number and returns the challenge expiry without the OTP', async () => {
    const expiresAt = new Date('2026-08-13T00:05:00.000Z')
    const sendOtp = vi.fn().mockResolvedValue({ expiresAt })
    const app = createApp({ sendOtp })

    const response = await app.request('/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+86 138-0013-8000' }),
    })

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ expiresAt: expiresAt.toISOString() })
    expect(sendOtp).toHaveBeenCalledWith({ phoneNumber: '+86 138-0013-8000' })
  })

  it('rejects an invalid phone number without invoking the service', async () => {
    const sendOtp = vi.fn()
    const app = createApp({ sendOtp })

    const response = await app.request('/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '123' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Invalid request body' },
    })
    expect(sendOtp).not.toHaveBeenCalled()
  })
})

describe('POST /auth/otp/verify', () => {
  it('returns the authenticated identity', async () => {
    const verifyPhoneOtp = vi.fn().mockResolvedValue({
      userId: 'user-id',
      accountId: 'account-id',
      sessionId: 'session-id',
    })
    const app = createApp({ verifyPhoneOtp })

    const response = await app.request('/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+8613800138000', otp: '123456' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      userId: 'user-id',
      accountId: 'account-id',
      sessionId: 'session-id',
    })
  })

  it('maps every rejected OTP to the same unauthorized response', async () => {
    const verifyPhoneOtp = vi.fn().mockRejectedValue(new InvalidOtpError())
    const app = createApp({ verifyPhoneOtp })

    const response = await app.request('/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+8613800138000', otp: '000000' }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' },
    })
  })
})
