export {
  InvalidCredentialsError,
  InvalidOtpError,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from './errors.js'
export { createLocalDevelopmentEmail } from './infra/local-development-email.js'
export { createLocalDevelopmentSms } from './infra/local-development-sms.js'
export { createPasswordService } from './infra/password.js'
export { createAuthModule } from './module.js'
export { createAuthRouter } from './router/routes.js'
export { completeEmailAuthentication } from './service/complete-email-authentication.js'
export { completePhoneAuthentication } from './service/complete-phone-authentication.js'
export { createEmailIdentity } from './service/create-email-identity.js'
export { createPhoneIdentity } from './service/create-phone-identity.js'
export { createSendEmailOtp, createVerifyEmailOtp } from './service/email-otp.js'
export { createEmailPasswordLogin, createResetEmailPassword } from './service/email-password.js'
export { revokeAllSessions, revokeSession } from './service/logout.js'
export { createRefreshSession, rotateRefreshToken } from './service/refresh-token.js'
export { createSendOtp } from './service/send-otp.js'
export { createVerifyOtp } from './service/verify-otp.js'
export type {
  AuthenticateAccessToken,
  AuthTokenPair,
  EmailSender,
  LoginWithEmailPassword,
  Logout,
  LogoutAll,
  RefreshSession,
  ResetEmailPassword,
  SendEmailOtp,
  SendOtp,
  SmsSender,
  VerifyEmailOtp,
  VerifyPhoneOtp,
} from './types.js'
export { authCookieNames } from './types.js'
