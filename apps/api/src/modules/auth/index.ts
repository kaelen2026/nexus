export { InvalidOtpError, InvalidRefreshTokenError, RefreshTokenReuseError } from './errors.js'
export { createLocalDevelopmentSms } from './infra/local-development-sms.js'
export { createAuthModule } from './module.js'
export { createAuthRouter } from './router/routes.js'
export { completePhoneAuthentication } from './service/complete-phone-authentication.js'
export { createPhoneIdentity } from './service/create-phone-identity.js'
export { revokeAllSessions, revokeSession } from './service/logout.js'
export { createRefreshSession, rotateRefreshToken } from './service/refresh-token.js'
export { createSendOtp } from './service/send-otp.js'
export { createVerifyOtp } from './service/verify-otp.js'
export type {
  AuthenticateAccessToken,
  AuthTokenPair,
  Logout,
  LogoutAll,
  RefreshSession,
  SendOtp,
  SmsSender,
  VerifyPhoneOtp,
} from './types.js'
export { authCookieNames } from './types.js'
