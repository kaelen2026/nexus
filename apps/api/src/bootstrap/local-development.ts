import { z } from 'zod'

import { createLocalDevelopmentSms } from '../modules/auth/index.js'
import { createLocalDevelopmentLlmProvider } from '../modules/llm/index.js'
import { createApiRuntime } from './runtime.js'

const localEnvironmentSchema = z.object({
  NODE_ENV: z.literal('development'),
})

const localDefaults = {
  DATABASE_URL: 'postgresql://nexus:nexus@localhost:5432/nexus',
  OTP_HASH_SECRET: 'local-development-otp-secret-32-characters',
  REDIS_URL: 'redis://localhost:6379',
  TOKEN_SECRET: 'local-development-token-secret-32-characters',
  TRUSTED_ORIGINS: 'http://localhost:3001',
} as const

export async function createLocalDevelopmentRuntime(options: {
  env: Record<string, string | undefined>
}) {
  const parsed = localEnvironmentSchema.safeParse(options.env)
  if (!parsed.success) {
    throw new Error('Local development adapters require NODE_ENV=development')
  }

  const sms = createLocalDevelopmentSms()
  const runtime = await createApiRuntime({
    env: {
      DATABASE_URL: options.env.DATABASE_URL ?? localDefaults.DATABASE_URL,
      OTP_HASH_SECRET: options.env.OTP_HASH_SECRET ?? localDefaults.OTP_HASH_SECRET,
      REDIS_URL: options.env.REDIS_URL ?? localDefaults.REDIS_URL,
      TOKEN_SECRET: options.env.TOKEN_SECRET ?? localDefaults.TOKEN_SECRET,
      TRUSTED_ORIGINS: options.env.TRUSTED_ORIGINS ?? localDefaults.TRUSTED_ORIGINS,
    },
    llmProvider: createLocalDevelopmentLlmProvider(),
    smsSender: sms.sender,
  })

  runtime.app.get('/dev/sms/latest', (context) => {
    const phoneNumber = context.req.query('phoneNumber')
    const message = phoneNumber ? sms.getLatest(phoneNumber) : undefined
    context.header('cache-control', 'no-store')
    if (!message) {
      return context.json(
        { error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found' } },
        404,
      )
    }
    return context.json(message)
  })

  return runtime
}
