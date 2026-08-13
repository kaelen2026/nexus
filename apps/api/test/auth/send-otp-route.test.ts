import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'

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
