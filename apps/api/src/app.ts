import { Hono } from 'hono'

import {
  createAuthRouter,
  type RefreshSession,
  type SendOtp,
  type VerifyPhoneOtp,
} from './modules/auth/index.js'

interface AppDependencies {
  sendOtp?: SendOtp
  verifyPhoneOtp?: VerifyPhoneOtp
  refreshSession?: RefreshSession
}

export function createApp(dependencies: AppDependencies = {}): Hono {
  const app = new Hono()
  app.get('/health', (context) => context.json({ status: 'ok' }))
  if (dependencies.sendOtp || dependencies.verifyPhoneOtp || dependencies.refreshSession) {
    app.route('/auth', createAuthRouter(dependencies))
  }
  return app
}
