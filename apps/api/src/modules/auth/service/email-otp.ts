import { InvalidOtpError } from '../errors.js'
import type { Clock, EmailSender, OtpChallengeStore } from '../types.js'
import { normalizeEmail } from './email.js'

interface EmailOtpDependencies {
  challengeStore: OtpChallengeStore
  hashOtp(subject: string, otp: string): string
}

export function createSendEmailOtp(
  dependencies: EmailOtpDependencies & {
    clock: Clock
    emailSender: EmailSender
    generateOtp(): string
    ttlSeconds: number
  },
) {
  return async (input: { email: string }): Promise<{ expiresAt: Date }> => {
    const email = normalizeEmail(input.email)
    const otp = dependencies.generateOtp()
    const expiresAt = new Date(dependencies.clock.now().getTime() + dependencies.ttlSeconds * 1_000)
    await dependencies.challengeStore.save({
      subject: email,
      otpHash: dependencies.hashOtp(email, otp),
      expiresAt,
    })
    await dependencies.emailSender.sendOtp({ email, otp })
    return { expiresAt }
  }
}

export function createVerifyEmailOtp(dependencies: EmailOtpDependencies) {
  return async (input: { email: string; otp: string }): Promise<void> => {
    const email = normalizeEmail(input.email)
    const consumed = await dependencies.challengeStore.consume(
      email,
      dependencies.hashOtp(email, input.otp),
    )
    if (!consumed) throw new InvalidOtpError()
  }
}
