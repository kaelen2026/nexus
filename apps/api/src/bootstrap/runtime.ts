import { createDatabase, migrateDatabase } from '@nexus/database'
import { z } from 'zod'

import { createApp } from '../app.js'
import {
  createConsoleObservabilitySink,
  createInMemoryHttpMetrics,
  type HttpMetrics,
  type ObservabilitySink,
} from '../gateway/index.js'
import {
  createAppleOAuthProvider,
  createAuthModule,
  createGoogleOAuthProvider,
  type EmailSender,
  type OAuthProvider,
  type SmsSender,
} from '../modules/auth/index.js'
import { createBillingModule } from '../modules/billing/index.js'
import { createLlmModule, type LlmProvider } from '../modules/llm/index.js'
import { createUsersModule } from '../modules/users/index.js'
import { createInMemoryEventBus } from '../shared/events/index.js'

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: z.url(),
  OTP_HASH_SECRET: z.string().min(32),
  REDIS_URL: z.url(),
  TOKEN_SECRET: z.string().min(32),
  TRUSTED_ORIGINS: z.string().transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
  APP_PUBLIC_URL: z.url().default('http://localhost:3001'),
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),
})

interface CreateApiRuntimeOptions {
  env: Record<string, string | undefined>
  generateOtp?: () => string
  emailSender?: EmailSender
  llmProvider: LlmProvider
  smsSender: SmsSender
  metrics?: HttpMetrics
  observabilitySink?: ObservabilitySink
}

export async function createApiRuntime(options: CreateApiRuntimeOptions) {
  const environment = runtimeEnvironmentSchema.parse(options.env)
  const metrics = options.metrics ?? createInMemoryHttpMetrics()
  const observabilitySink = options.observabilitySink ?? createConsoleObservabilitySink()
  if (Boolean(environment.GOOGLE_CLIENT_ID) !== Boolean(environment.GOOGLE_CLIENT_SECRET)) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together')
  }
  const appleConfiguration = [
    environment.APPLE_CLIENT_ID,
    environment.APPLE_KEY_ID,
    environment.APPLE_TEAM_ID,
    environment.APPLE_PRIVATE_KEY,
  ]
  if (appleConfiguration.some(Boolean) && !appleConfiguration.every(Boolean)) {
    throw new Error('All Apple OAuth environment variables must be configured together')
  }
  const oauthProviders: OAuthProvider[] = []
  if (environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET) {
    oauthProviders.push(
      createGoogleOAuthProvider({
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
        redirectUri: `${environment.API_PUBLIC_URL}/auth/oauth/google/callback`,
      }),
    )
  }
  if (
    environment.APPLE_CLIENT_ID &&
    environment.APPLE_KEY_ID &&
    environment.APPLE_TEAM_ID &&
    environment.APPLE_PRIVATE_KEY
  ) {
    oauthProviders.push(
      createAppleOAuthProvider({
        clientId: environment.APPLE_CLIENT_ID,
        keyId: environment.APPLE_KEY_ID,
        teamId: environment.APPLE_TEAM_ID,
        privateKey: environment.APPLE_PRIVATE_KEY,
        redirectUri: `${environment.API_PUBLIC_URL}/auth/oauth/apple/callback`,
      }),
    )
  }
  const database = createDatabase({ url: environment.DATABASE_URL })
  await migrateDatabase(database.client)
  const eventBus = createInMemoryEventBus()
  const billing = createBillingModule({ database: database.client, eventBus })
  const llm = createLlmModule({
    database: database.client,
    billing,
    provider: options.llmProvider,
  })
  const users = createUsersModule({ database: database.client, eventBus })

  let auth: Awaited<ReturnType<typeof createAuthModule>>
  try {
    await users.replayPendingEvents()
    auth = await createAuthModule({
      database: database.client,
      ...(options.emailSender ? { emailSender: options.emailSender } : {}),
      ...(options.generateOtp ? { generateOtp: options.generateOtp } : {}),
      otpHashSecret: environment.OTP_HASH_SECRET,
      redisUrl: environment.REDIS_URL,
      smsSender: options.smsSender,
      tokenSecret: environment.TOKEN_SECRET,
      publishUserCreated: users.publishUserCreated,
      oauthProviders,
    })
  } catch (error) {
    billing.close()
    await database.close()
    throw error
  }
  const app = createApp({
    authenticateAccessToken: auth.authenticateAccessToken,
    sendOtp: auth.sendOtp,
    ...('sendEmailOtp' in auth ? { sendEmailOtp: auth.sendEmailOtp } : {}),
    ...('verifyEmailOtp' in auth ? { verifyEmailOtp: auth.verifyEmailOtp } : {}),
    loginWithEmailPassword: auth.loginWithEmailPassword,
    ...('resetEmailPassword' in auth ? { resetEmailPassword: auth.resetEmailPassword } : {}),
    verifyPhoneOtp: auth.verifyPhoneOtp,
    refreshSession: auth.refreshSession,
    trustedOrigins: environment.TRUSTED_ORIGINS,
    getCurrentUser: users.getCurrentUser,
    logout: auth.logout,
    logoutAll: auth.logoutAll,
    generate: llm.generate,
    startOAuth: auth.startOAuth,
    completeOAuth: auth.completeOAuth,
    authWebUrl: environment.APP_PUBLIC_URL,
    metrics,
    observabilitySink,
  })

  return {
    app,
    metrics,
    async close() {
      billing.close()
      await Promise.allSettled([auth.close(), database.close()])
    },
  }
}
