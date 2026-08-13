import { Hono } from 'hono'

import {
  createAuthenticationMiddleware,
  createCorsMiddleware,
  createHttpObservabilityMiddleware,
  createRequestContextMiddleware,
  type GatewayEnvironment,
  type HttpMetrics,
  type ObservabilitySink,
} from './gateway/index.js'
import {
  type AuthenticateAccessToken,
  type CompleteOAuth,
  createAuthRouter,
  type DeleteAccount,
  type LoginWithEmailPassword,
  type Logout,
  type LogoutAll,
  type RefreshSession,
  type ResetEmailPassword,
  type SendEmailOtp,
  type SendOtp,
  type StartOAuth,
  type VerifyEmailOtp,
  type VerifyPhoneOtp,
} from './modules/auth/index.js'
import { createLlmRouter, type Generate, type GenerateStream } from './modules/llm/index.js'
import {
  createUsersRouter,
  type GetCurrentUser,
  type GetProfile,
  type GetSettings,
  type UpdateProfile,
  type UpdateSettings,
} from './modules/users/index.js'

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
  loginWithEmailPassword?: LoginWithEmailPassword
  resetEmailPassword?: ResetEmailPassword
  getCurrentUser?: GetCurrentUser
  deleteAccount?: DeleteAccount
  getProfile?: GetProfile
  updateProfile?: UpdateProfile
  getSettings?: GetSettings
  updateSettings?: UpdateSettings
  generate?: Generate
  generateStream?: GenerateStream
  startOAuth?: StartOAuth
  completeOAuth?: CompleteOAuth
  authWebUrl?: string
  metrics?: HttpMetrics
  observabilitySink?: ObservabilitySink
}

export function createApp(dependencies: AppDependencies = {}): Hono<GatewayEnvironment> {
  const app = new Hono<GatewayEnvironment>()
  app.use('*', createRequestContextMiddleware())
  app.use(
    '*',
    createHttpObservabilityMiddleware({
      ...(dependencies.metrics ? { metrics: dependencies.metrics } : {}),
      ...(dependencies.observabilitySink ? { sink: dependencies.observabilitySink } : {}),
    }),
  )
  app.use('*', createCorsMiddleware({ trustedOrigins: dependencies.trustedOrigins ?? [] }))
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
  if (dependencies.metrics) {
    app.get('/metrics', (context) => context.text(dependencies.metrics?.render() ?? ''))
  }
  if (
    dependencies.sendOtp ||
    dependencies.sendEmailOtp ||
    dependencies.verifyEmailOtp ||
    dependencies.loginWithEmailPassword ||
    dependencies.resetEmailPassword ||
    dependencies.verifyPhoneOtp ||
    dependencies.refreshSession ||
    dependencies.logout ||
    dependencies.logoutAll ||
    dependencies.startOAuth ||
    dependencies.completeOAuth
  ) {
    app.route('/auth', createAuthRouter(dependencies))
  }
  if (dependencies.getCurrentUser) {
    app.route(
      '/users',
      createUsersRouter({
        getCurrentUser: dependencies.getCurrentUser,
        ...(dependencies.deleteAccount ? { deleteAccount: dependencies.deleteAccount } : {}),
        ...(dependencies.getProfile ? { getProfile: dependencies.getProfile } : {}),
        ...(dependencies.updateProfile ? { updateProfile: dependencies.updateProfile } : {}),
        ...(dependencies.getSettings ? { getSettings: dependencies.getSettings } : {}),
        ...(dependencies.updateSettings ? { updateSettings: dependencies.updateSettings } : {}),
      }),
    )
  }
  if (dependencies.generate || dependencies.generateStream) {
    app.route(
      '/llm',
      createLlmRouter({
        ...(dependencies.generate ? { generate: dependencies.generate } : {}),
        ...(dependencies.generateStream ? { generateStream: dependencies.generateStream } : {}),
      }),
    )
  }
  return app
}
