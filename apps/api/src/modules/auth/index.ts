export {
  InvalidOAuthCallbackError,
  InvalidOtpError,
  InvalidRefreshTokenError,
  OAuthProviderUnavailableError,
  RefreshTokenReuseError,
} from './errors.js'
export { createLocalDevelopmentEmail } from './infra/local-development-email.js'
export { createLocalDevelopmentSms } from './infra/local-development-sms.js'
export { createAppleOAuthProvider } from './infra/providers/apple.js'
export { createGoogleOAuthProvider } from './infra/providers/google.js'
export { createAuthModule } from './module.js'
export { createAuthRouter } from './router/routes.js'
export { completeEmailAuthentication } from './service/complete-email-authentication.js'
export { completePhoneAuthentication } from './service/complete-phone-authentication.js'
export { createOAuthIdentity } from './service/create-oauth-identity.js'
export { createEmailIdentity } from './service/create-email-identity.js'
export { createPhoneIdentity } from './service/create-phone-identity.js'
export { createSendEmailOtp, createVerifyEmailOtp } from './service/email-otp.js'
export { revokeAllSessions, revokeSession } from './service/logout.js'
export { createRefreshSession, rotateRefreshToken } from './service/refresh-token.js'
export { createSendOtp } from './service/send-otp.js'
export { createVerifyOtp } from './service/verify-otp.js'
export type {
  AuthenticateAccessToken,
  AuthTokenPair,
  CompleteOAuth,
  EmailSender,
  Logout,
  LogoutAll,
  OAuthProvider,
  OAuthProviderId,
  RefreshSession,
  SendEmailOtp,
  SendOtp,
  SmsSender,
  StartOAuth,
  VerifyEmailOtp,
  VerifyPhoneOtp,
} from './types.js'
export { authCookieNames } from './types.js'
