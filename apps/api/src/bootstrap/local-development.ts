import { z } from 'zod'

import { createLocalDevelopmentEmail, createLocalDevelopmentSms } from '../modules/auth/index.js'
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
  APP_PUBLIC_URL: 'http://localhost:3001',
  API_PUBLIC_URL: 'http://localhost:3000',
} as const

export async function createLocalDevelopmentRuntime(options: {
  env: Record<string, string | undefined>
}) {
  const parsed = localEnvironmentSchema.safeParse(options.env)
  if (!parsed.success) {
    throw new Error('Local development adapters require NODE_ENV=development')
  }

  const sms = createLocalDevelopmentSms()
  const email = createLocalDevelopmentEmail()
  const runtime = await createApiRuntime({
    env: {
      DATABASE_URL: options.env.DATABASE_URL ?? localDefaults.DATABASE_URL,
      OTP_HASH_SECRET: options.env.OTP_HASH_SECRET ?? localDefaults.OTP_HASH_SECRET,
      REDIS_URL: options.env.REDIS_URL ?? localDefaults.REDIS_URL,
      TOKEN_SECRET: options.env.TOKEN_SECRET ?? localDefaults.TOKEN_SECRET,
      TRUSTED_ORIGINS: options.env.TRUSTED_ORIGINS ?? localDefaults.TRUSTED_ORIGINS,
      APP_PUBLIC_URL: options.env.APP_PUBLIC_URL ?? localDefaults.APP_PUBLIC_URL,
      API_PUBLIC_URL: options.env.API_PUBLIC_URL ?? localDefaults.API_PUBLIC_URL,
      ...(options.env.GOOGLE_CLIENT_ID ? { GOOGLE_CLIENT_ID: options.env.GOOGLE_CLIENT_ID } : {}),
      ...(options.env.GOOGLE_CLIENT_SECRET
        ? { GOOGLE_CLIENT_SECRET: options.env.GOOGLE_CLIENT_SECRET }
        : {}),
      ...(options.env.APPLE_CLIENT_ID ? { APPLE_CLIENT_ID: options.env.APPLE_CLIENT_ID } : {}),
      ...(options.env.APPLE_KEY_ID ? { APPLE_KEY_ID: options.env.APPLE_KEY_ID } : {}),
      ...(options.env.APPLE_TEAM_ID ? { APPLE_TEAM_ID: options.env.APPLE_TEAM_ID } : {}),
      ...(options.env.APPLE_PRIVATE_KEY
        ? { APPLE_PRIVATE_KEY: options.env.APPLE_PRIVATE_KEY }
        : {}),
    },
    emailSender: email.sender,
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

  runtime.app.get('/dev/email/latest', (context) => {
    const address = context.req.query('email')
    const message = address ? email.getLatest(address) : undefined
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
