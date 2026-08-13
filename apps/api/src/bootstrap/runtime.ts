import { createClient } from 'redis'
import { z } from 'zod'

import { createApp } from '../app.js'
import { createAuthModule, type SmsSender } from '../modules/auth/index.js'

const runtimeEnvironmentSchema = z.object({
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
  const redis = createClient({ url: environment.REDIS_URL })
  await redis.connect()

  const auth = createAuthModule({
    ...(options.generateOtp ? { generateOtp: options.generateOtp } : {}),
    otpHashSecret: environment.OTP_HASH_SECRET,
    redis,
    smsSender: options.smsSender,
  })
  const app = createApp({ sendOtp: auth.sendOtp })

  return {
    app,
    async close() {
      if (redis.isOpen) await redis.quit()
    },
  }
}
