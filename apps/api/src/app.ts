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
  type RefreshSession,
  type SendOtp,
  type VerifyPhoneOtp,
} from './modules/auth/index.js'
import { createUsersRouter, type GetCurrentUser } from './modules/users/index.js'

interface AppDependencies {
  authenticateAccessToken?: AuthenticateAccessToken
  trustedOrigins?: string[]
  sendOtp?: SendOtp
  verifyPhoneOtp?: VerifyPhoneOtp
  refreshSession?: RefreshSession
  getCurrentUser?: GetCurrentUser
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
  if (dependencies.sendOtp || dependencies.verifyPhoneOtp || dependencies.refreshSession) {
    app.route('/auth', createAuthRouter(dependencies))
  }
  if (dependencies.getCurrentUser) {
    app.route('/users', createUsersRouter({ getCurrentUser: dependencies.getCurrentUser }))
  }
  return app
}
