import { describe, expect, it, vi } from 'vitest'

import { createVerifyOtp, InvalidOtpError } from '../../src/modules/auth/index.js'

describe('verifyOtp', () => {
  it('hashes and consumes a valid OTP', async () => {
    const consume = vi.fn().mockResolvedValue(true)
    const verifyOtp = createVerifyOtp({
      challengeStore: { save: vi.fn(), consume },
      hashOtp: (phoneNumber, otp) => `hash:${phoneNumber}:${otp}`,
    })

    await expect(
      verifyOtp({ phoneNumber: '+86 138-0013-8000', otp: '123456' }),
    ).resolves.toBeUndefined()
    expect(consume).toHaveBeenCalledWith('+8613800138000', 'hash:+8613800138000:123456')
  })

  it('rejects an invalid, expired, or consumed OTP with the same error', async () => {
    const verifyOtp = createVerifyOtp({
      challengeStore: { save: vi.fn(), consume: vi.fn().mockResolvedValue(false) },
      hashOtp: vi.fn().mockReturnValue('hash'),
    })

    await expect(
      verifyOtp({ phoneNumber: '+8613800138000', otp: '000000' }),
    ).rejects.toBeInstanceOf(InvalidOtpError)
  })
})
