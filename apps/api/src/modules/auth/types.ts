export interface OtpChallenge {
  phoneNumber: string
  otpHash: string
  expiresAt: Date
}

export interface OtpChallengeStore {
  save(challenge: OtpChallenge): Promise<void>
}

export interface SmsSender {
  sendOtp(message: { phoneNumber: string; otp: string }): Promise<void>
}

export interface Clock {
  now(): Date
}
