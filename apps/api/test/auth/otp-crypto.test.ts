import { describe, expect, it } from 'vitest'

import { createOtpHasher, generateOtp } from '../../src/modules/auth/infra/otp.js'

describe('OTP cryptography', () => {
  it('generates a six-digit numeric OTP', () => {
    for (let sample = 0; sample < 100; sample += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('hashes the OTP with the phone number and server secret', () => {
    const hashOtp = createOtpHasher('test-secret-at-least-32-characters')

    const hash = hashOtp('+8613800138000', '123456')

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).toBe(hashOtp('+8613800138000', '123456'))
    expect(hash).not.toBe(hashOtp('+8613800138001', '123456'))
    expect(hash).not.toBe(hashOtp('+8613800138000', '654321'))
    expect(hash).not.toBe(
      createOtpHasher('different-test-secret-32-characters')('+8613800138000', '123456'),
    )
  })

  it('rejects a short server secret', () => {
    expect(() => createOtpHasher('too-short')).toThrow(
      'OTP hash secret must be at least 32 characters',
    )
  })
})
