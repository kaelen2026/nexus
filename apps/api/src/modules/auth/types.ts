export interface OtpChallenge {
  phoneNumber: string
  otpHash: string
  expiresAt: Date
}

export interface OtpChallengeStore {
  save(challenge: OtpChallenge): Promise<void>
  consume(phoneNumber: string, otpHash: string): Promise<boolean>
}

export interface SmsSender {
  sendOtp(message: { phoneNumber: string; otp: string }): Promise<void>
}

export interface Clock {
  now(): Date
}

export type SendOtp = (input: { phoneNumber: string }) => Promise<{ expiresAt: Date }>
