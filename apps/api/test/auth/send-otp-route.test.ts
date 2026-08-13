import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { InvalidOtpError, InvalidRefreshTokenError } from '../../src/modules/auth/index.js'

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
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date('2026-08-13T00:15:00.000Z'),
      refreshToken: 'refresh-token',
    })
    const app = createApp({ verifyPhoneOtp })

    const response = await app.request('/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+8613800138000', otp: '123456' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tokenType: 'Bearer',
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-08-13T00:15:00.000Z',
      refreshToken: 'refresh-token',
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

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and returns a new token pair', async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      tokenType: 'Bearer',
      accessToken: 'next-access-token',
      accessTokenExpiresAt: new Date('2026-08-13T00:15:00.000Z'),
      refreshToken: 'next-refresh-token',
    })
    const app = createApp({ refreshSession })

    const response = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'opaque-refresh-token-at-least-32-characters' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tokenType: 'Bearer',
      accessToken: 'next-access-token',
      accessTokenExpiresAt: '2026-08-13T00:15:00.000Z',
      refreshToken: 'next-refresh-token',
    })
  })

  it('does not disclose why a refresh token is rejected', async () => {
    const refreshSession = vi.fn().mockRejectedValue(new InvalidRefreshTokenError())
    const app = createApp({ refreshSession })

    const response = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid-refresh-token-at-least-32-characters' }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
    })
  })
})
