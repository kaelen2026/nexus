import { describe, expect, it, vi } from 'vitest'

import { completePhoneAuthentication, InvalidOtpError } from '../../src/modules/auth/index.js'

describe('completePhoneAuthentication', () => {
  it('creates the identity only after the OTP is consumed', async () => {
    const consumeOtp = vi.fn().mockResolvedValue(undefined)
    const createIdentity = vi.fn().mockResolvedValue({
      userId: 'user-id',
      accountId: 'account-id',
      sessionId: 'session-id',
    })

    const result = await completePhoneAuthentication(
      { consumeOtp, createIdentity },
      {
        phoneNumber: '+8613800138000',
        otp: '123456',
        sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
      },
    )

    expect(consumeOtp).toHaveBeenCalledWith({ phoneNumber: '+8613800138000', otp: '123456' })
    expect(createIdentity).toHaveBeenCalledWith({
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })
    expect(result).toEqual({ userId: 'user-id', accountId: 'account-id', sessionId: 'session-id' })
    expect(consumeOtp.mock.invocationCallOrder[0]).toBeLessThan(
      createIdentity.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('does not touch identity persistence when OTP consumption fails', async () => {
    const consumeOtp = vi.fn().mockRejectedValue(new InvalidOtpError())
    const createIdentity = vi.fn()

    await expect(
      completePhoneAuthentication(
        { consumeOtp, createIdentity },
        {
          phoneNumber: '+8613800138000',
          otp: '000000',
          sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
        },
      ),
    ).rejects.toBeInstanceOf(InvalidOtpError)
    expect(createIdentity).not.toHaveBeenCalled()
  })
})
