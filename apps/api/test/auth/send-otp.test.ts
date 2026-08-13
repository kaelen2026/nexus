import { describe, expect, it, vi } from 'vitest'

import { createSendOtp } from '../../src/modules/auth/index.js'

describe('sendOtp', () => {
  it('stores an expiring hash and sends the OTP to the normalized phone number', async () => {
    const saveChallenge = vi.fn()
    const sendSms = vi.fn()
    const now = new Date('2026-08-13T00:00:00.000Z')
    const sendOtp = createSendOtp({
      clock: { now: () => now },
      challengeStore: { save: saveChallenge },
      generateOtp: () => '123456',
      hashOtp: (phoneNumber, otp) => `hash:${phoneNumber}:${otp}`,
      smsSender: { sendOtp: sendSms },
      ttlSeconds: 300,
    })

    const result = await sendOtp({ phoneNumber: ' +86 138-0013-8000 ' })

    expect(saveChallenge).toHaveBeenCalledWith({
      phoneNumber: '+8613800138000',
      otpHash: 'hash:+8613800138000:123456',
      expiresAt: new Date('2026-08-13T00:05:00.000Z'),
    })
    expect(saveChallenge).not.toHaveBeenCalledWith(expect.objectContaining({ otp: '123456' }))
    expect(sendSms).toHaveBeenCalledWith({ phoneNumber: '+8613800138000', otp: '123456' })
    expect(result).toEqual({ expiresAt: new Date('2026-08-13T00:05:00.000Z') })
  })
})
