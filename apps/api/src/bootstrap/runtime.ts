import { createDatabase, migrateDatabase } from '@nexus/database'
import { z } from 'zod'

import { createApp } from '../app.js'
import { createAuthModule, type SmsSender } from '../modules/auth/index.js'
import { createBillingModule } from '../modules/billing/index.js'
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
})

interface CreateApiRuntimeOptions {
  env: Record<string, string | undefined>
  generateOtp?: () => string
  smsSender: SmsSender
}

export async function createApiRuntime(options: CreateApiRuntimeOptions) {
  const environment = runtimeEnvironmentSchema.parse(options.env)
  const database = createDatabase({ url: environment.DATABASE_URL })
  await migrateDatabase(database.client)
  const eventBus = createInMemoryEventBus()
  const billing = createBillingModule({ database: database.client, eventBus })
  const users = createUsersModule({ database: database.client, eventBus })

  let auth: Awaited<ReturnType<typeof createAuthModule>>
  try {
    auth = await createAuthModule({
      database: database.client,
      ...(options.generateOtp ? { generateOtp: options.generateOtp } : {}),
      otpHashSecret: environment.OTP_HASH_SECRET,
      redisUrl: environment.REDIS_URL,
      smsSender: options.smsSender,
      tokenSecret: environment.TOKEN_SECRET,
      publishUserCreated: users.publishUserCreated,
    })
  } catch (error) {
    billing.close()
    await database.close()
    throw error
  }
  const app = createApp({
    authenticateAccessToken: auth.authenticateAccessToken,
    sendOtp: auth.sendOtp,
    verifyPhoneOtp: auth.verifyPhoneOtp,
    refreshSession: auth.refreshSession,
    trustedOrigins: environment.TRUSTED_ORIGINS,
    getCurrentUser: users.getCurrentUser,
    logout: auth.logout,
    logoutAll: auth.logoutAll,
  })

  return {
    app,
    async close() {
      billing.close()
      await Promise.allSettled([auth.close(), database.close()])
    },
  }
}
