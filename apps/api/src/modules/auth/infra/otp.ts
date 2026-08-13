import { createHmac, randomInt } from 'node:crypto'

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function createOtpHasher(secret: string) {
  if (secret.length < 32) {
    throw new Error('OTP hash secret must be at least 32 characters')
  }

  return function hashOtp(phoneNumber: string, otp: string): string {
    return createHmac('sha256', secret).update(`${phoneNumber}\0${otp}`).digest('hex')
  }
}
