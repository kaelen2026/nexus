export interface OtpChallenge {
  subject: string
  otpHash: string
  expiresAt: Date
}

export interface OtpChallengeStore {
  save(challenge: OtpChallenge): Promise<void>
  consume(subject: string, otpHash: string): Promise<boolean>
}

export interface SmsSender {
  sendOtp(message: { phoneNumber: string; otp: string }): Promise<void>
}

export interface EmailSender {
  sendOtp(message: { email: string; otp: string }): Promise<void>
}

export interface Clock {
  now(): Date
}

export type SendOtp = (input: { phoneNumber: string }) => Promise<{ expiresAt: Date }>
export type SendEmailOtp = (input: { email: string }) => Promise<{ expiresAt: Date }>

export type VerifyPhoneOtp = (input: { phoneNumber: string; otp: string }) => Promise<AuthTokenPair>
export type VerifyEmailOtp = (input: { email: string; otp: string }) => Promise<AuthTokenPair>

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

export type OAuthProviderId = 'google' | 'apple'
export type StartOAuth = (input: { provider: OAuthProviderId }) => Promise<string>
export type CompleteOAuth = (input: {
  provider: OAuthProviderId
  code: string
  state: string
}) => Promise<AuthTokenPair>

export interface OAuthFlow {
  provider: OAuthProviderId
  codeVerifier: string
  nonce: string
}

export interface OAuthFlowStore {
  save(state: string, flow: OAuthFlow): Promise<void>
  consume(state: string): Promise<OAuthFlow | undefined>
}

export interface OAuthProvider {
  id: OAuthProviderId
  createAuthorizationUrl(input: { state: string; nonce: string; codeChallenge: string }): URL
  exchangeCode(input: { code: string; nonce: string; codeVerifier: string }): Promise<{
    providerSubject: string
  }>
}

export const authCookieNames = {
  access: '__Host-nexus_access',
  refresh: '__Secure-nexus_refresh',
} as const
