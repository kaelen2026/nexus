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
})
