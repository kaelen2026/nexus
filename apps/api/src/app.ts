import { Hono } from 'hono'

import { createAuthRouter, type SendOtp } from './modules/auth/index.js'

interface AppDependencies {
  sendOtp?: SendOtp
}

export function createApp(dependencies: AppDependencies = {}): Hono {
  const app = new Hono()
  app.get('/health', (context) => context.json({ status: 'ok' }))
  if (dependencies.sendOtp) app.route('/auth', createAuthRouter(dependencies.sendOtp))
  return app
}
