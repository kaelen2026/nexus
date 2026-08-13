import { Hono } from 'hono'

import {
  createAuthenticationMiddleware,
  createCorsMiddleware,
  createRequestContextMiddleware,
  type GatewayEnvironment,
} from './gateway/index.js'
import {
  type AuthenticateAccessToken,
  createAuthRouter,
  type Logout,
  type LogoutAll,
  type RefreshSession,
  type SendEmailOtp,
  type SendOtp,
  type VerifyEmailOtp,
  type VerifyPhoneOtp,
} from './modules/auth/index.js'
import { createLlmRouter, type Generate } from './modules/llm/index.js'
import { createUsersRouter, type GetCurrentUser } from './modules/users/index.js'

interface AppDependencies {
  authenticateAccessToken?: AuthenticateAccessToken
  trustedOrigins?: string[]
  sendOtp?: SendOtp
  sendEmailOtp?: SendEmailOtp
  verifyEmailOtp?: VerifyEmailOtp
  verifyPhoneOtp?: VerifyPhoneOtp
  refreshSession?: RefreshSession
  logout?: Logout
  logoutAll?: LogoutAll
  getCurrentUser?: GetCurrentUser
  generate?: Generate
}

export function createApp(dependencies: AppDependencies = {}): Hono<GatewayEnvironment> {
  const app = new Hono<GatewayEnvironment>()
  app.use('*', createCorsMiddleware({ trustedOrigins: dependencies.trustedOrigins ?? [] }))
  app.use('*', createRequestContextMiddleware())
  if (dependencies.authenticateAccessToken) {
    app.use(
      '*',
      createAuthenticationMiddleware({
        authenticateAccessToken: dependencies.authenticateAccessToken,
        trustedOrigins: dependencies.trustedOrigins ?? [],
      }),
    )
  }
  app.get('/health', (context) => context.json({ status: 'ok' }))
  if (
    dependencies.sendOtp ||
    dependencies.sendEmailOtp ||
    dependencies.verifyEmailOtp ||
    dependencies.verifyPhoneOtp ||
    dependencies.refreshSession ||
    dependencies.logout ||
    dependencies.logoutAll
  ) {
    app.route('/auth', createAuthRouter(dependencies))
  }
  if (dependencies.getCurrentUser) {
    app.route('/users', createUsersRouter({ getCurrentUser: dependencies.getCurrentUser }))
  }
  if (dependencies.generate) {
    app.route('/llm', createLlmRouter({ generate: dependencies.generate }))
  }
  return app
}
