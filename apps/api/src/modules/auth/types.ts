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

export type VerifyPhoneOtp = (input: { phoneNumber: string; otp: string }) => Promise<AuthTokenPair>

export interface AuthTokenPair {
  tokenType: 'Bearer'
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string
}

export type RefreshSession = (input: { refreshToken: string }) => Promise<AuthTokenPair>

export type AuthenticateAccessToken = (token: string) => Promise<{
  type: 'user'
  subject: string
  accountId: string
  sessionId: string
  roles: string[]
  scopes: string[]
}>

export type Logout = (input: { sessionId: string }) => Promise<void>
export type LogoutAll = (input: { userId: string }) => Promise<void>

export const authCookieNames = {
  access: '__Host-nexus_access',
  refresh: '__Secure-nexus_refresh',
} as const
