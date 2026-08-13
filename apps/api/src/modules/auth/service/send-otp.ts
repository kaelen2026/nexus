import type { Clock, OtpChallengeStore, SmsSender } from '../types.js'
import { normalizePhoneNumber } from './phone-number.js'

interface SendOtpDependencies {
  clock: Clock
  challengeStore: OtpChallengeStore
  generateOtp(): string
  hashOtp(phoneNumber: string, otp: string): string
  smsSender: SmsSender
  ttlSeconds: number
}

interface SendOtpInput {
  phoneNumber: string
}

export function createSendOtp(dependencies: SendOtpDependencies) {
  return async function sendOtp(input: SendOtpInput): Promise<{ expiresAt: Date }> {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber)
    const otp = dependencies.generateOtp()
    const expiresAt = new Date(dependencies.clock.now().getTime() + dependencies.ttlSeconds * 1_000)

    await dependencies.challengeStore.save({
      phoneNumber,
      otpHash: dependencies.hashOtp(phoneNumber, otp),
      expiresAt,
    })
    await dependencies.smsSender.sendOtp({ phoneNumber, otp })

    return { expiresAt }
  }
}
