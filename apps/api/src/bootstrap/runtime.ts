import { createDatabase, migrateDatabase } from '@nexus/database'
import { z } from 'zod'

import { createApp } from '../app.js'
import { createAuthModule, type SmsSender } from '../modules/auth/index.js'

const runtimeEnvironmentSchema = z.object({
  DATABASE_URL: z.url(),
  OTP_HASH_SECRET: z.string().min(32),
  REDIS_URL: z.url(),
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

  let auth: Awaited<ReturnType<typeof createAuthModule>>
  try {
    auth = await createAuthModule({
      database: database.client,
      ...(options.generateOtp ? { generateOtp: options.generateOtp } : {}),
      otpHashSecret: environment.OTP_HASH_SECRET,
      redisUrl: environment.REDIS_URL,
      smsSender: options.smsSender,
    })
  } catch (error) {
    await database.close()
    throw error
  }
  const app = createApp({ sendOtp: auth.sendOtp, verifyPhoneOtp: auth.verifyPhoneOtp })

  return {
    app,
    async close() {
      await Promise.allSettled([auth.close(), database.close()])
    },
  }
}
