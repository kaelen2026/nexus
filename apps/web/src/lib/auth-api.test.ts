import { afterEach, describe, expect, it, vi } from 'vitest'

import { authApi } from './auth-api'

describe('authApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests a cookie session without exposing token storage to JavaScript', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionMode: 'cookie',
          accessTokenExpiresAt: '2026-08-13T08:15:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await authApi.verifyOtp({
      phoneNumber: '+86 138 0000 0000',
      otp: '123456',
      sessionMode: 'cookie',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/otp/verify',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: '+86 138 0000 0000',
          otp: '123456',
          sessionMode: 'cookie',
        }),
      }),
    )
  })

  it('maps INVALID_OTP to a safe user-facing error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      authApi.verifyOtp({
        phoneNumber: '+86 138 0000 0000',
        otp: '123456',
        sessionMode: 'cookie',
      }),
    ).rejects.toThrow('验证码无效或已过期')
  })

  it('uses the email OTP endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ expiresAt: '2026-08-13T08:05:00.000Z' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await authApi.sendEmailOtp({ email: 'alice@example.com' })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/email/otp/send',
      expect.objectContaining({ body: JSON.stringify({ email: 'alice@example.com' }) }),
    )
  })

  it('uses the email password login endpoint with cookie mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionMode: 'cookie',
          accessTokenExpiresAt: '2026-08-13T08:15:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await authApi.loginWithEmailPassword({
      email: 'alice@example.com',
      password: 'correct horse battery staple',
      sessionMode: 'cookie',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/email/password/login',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    )
  })

  it('uses the email password reset endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await authApi.resetEmailPassword({
      email: 'alice@example.com',
      otp: '123456',
      newPassword: 'correct horse battery staple',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/email/password/reset',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
