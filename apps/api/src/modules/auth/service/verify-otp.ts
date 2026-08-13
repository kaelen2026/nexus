import { InvalidOtpError } from '../errors.js'
import type { OtpChallengeStore } from '../types.js'
import { normalizePhoneNumber } from './phone-number.js'

interface VerifyOtpDependencies {
  challengeStore: OtpChallengeStore
  hashOtp(phoneNumber: string, otp: string): string
}

export function createVerifyOtp(dependencies: VerifyOtpDependencies) {
  return async function verifyOtp(input: { phoneNumber: string; otp: string }): Promise<void> {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber)
    const consumed = await dependencies.challengeStore.consume(
      phoneNumber,
      dependencies.hashOtp(phoneNumber, input.otp),
    )

    if (!consumed) throw new InvalidOtpError()
  }
}
