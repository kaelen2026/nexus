import { describe, expect, it, vi } from 'vitest'

import { createSendEmailOtp, createVerifyEmailOtp } from '../../src/modules/auth/index.js'

describe('email OTP', () => {
  it('stores an expiring hash and sends the OTP to the normalized email address', async () => {
    const saveChallenge = vi.fn()
    const sendEmail = vi.fn()
    const sendOtp = createSendEmailOtp({
      clock: { now: () => new Date('2026-08-13T00:00:00.000Z') },
      challengeStore: { save: saveChallenge, consume: vi.fn() },
      emailSender: { sendOtp: sendEmail },
      generateOtp: () => '123456',
      hashOtp: (subject, otp) => `hash:${subject}:${otp}`,
      ttlSeconds: 300,
    })

    await expect(sendOtp({ email: ' Alice@Example.COM ' })).resolves.toEqual({
      expiresAt: new Date('2026-08-13T00:05:00.000Z'),
    })
    expect(saveChallenge).toHaveBeenCalledWith({
      subject: 'alice@example.com',
      otpHash: 'hash:alice@example.com:123456',
      expiresAt: new Date('2026-08-13T00:05:00.000Z'),
    })
    expect(sendEmail).toHaveBeenCalledWith({ email: 'alice@example.com', otp: '123456' })
  })

  it('consumes the normalized email challenge', async () => {
    const consume = vi.fn().mockResolvedValue(true)
    const verifyOtp = createVerifyEmailOtp({
      challengeStore: { save: vi.fn(), consume },
      hashOtp: (subject, otp) => `hash:${subject}:${otp}`,
    })

    await verifyOtp({ email: ' Alice@Example.COM ', otp: '123456' })

    expect(consume).toHaveBeenCalledWith('alice@example.com', 'hash:alice@example.com:123456')
  })
})
