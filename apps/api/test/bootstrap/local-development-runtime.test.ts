import { createDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createLocalDevelopmentRuntime } from '../../src/bootstrap/local-development.js'

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus'
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const database = createDatabase({ url: databaseUrl })
const environment = {
  DATABASE_URL: databaseUrl,
  NODE_ENV: 'development',
  OTP_HASH_SECRET: 'test-secret-at-least-32-characters',
  REDIS_URL: redisUrl,
  TOKEN_SECRET: 'test-token-secret-at-least-32-characters',
  TRUSTED_ORIGINS: 'https://app.nexus.test',
}

beforeEach(async () => {
  await database.client.execute(
    sql`truncate llm_requests, billing_usage_records, billing_usage_reservations, billing_event_receipts, billing_subscriptions, billing_plans, auth_sessions, auth_accounts, users cascade`,
  )
})

afterAll(async () => database.close())

describe('local development runtime', () => {
  it('rejects local adapters outside development', async () => {
    await expect(
      createLocalDevelopmentRuntime({ env: { ...environment, NODE_ENV: 'production' } }),
    ).rejects.toThrow('Local development adapters require NODE_ENV=development')
  })

  it('delivers OTPs to the local inbox and generates through the local provider', async () => {
    const runtime = await createLocalDevelopmentRuntime({ env: environment })

    try {
      const phoneNumber = '+8613800138000'
      const sendResponse = await runtime.app.request('/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })
      expect(sendResponse.status).toBe(202)

      const inboxResponse = await runtime.app.request(
        `/dev/sms/latest?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      )
      expect(inboxResponse.status).toBe(200)
      expect(inboxResponse.headers.get('cache-control')).toBe('no-store')
      const message = (await inboxResponse.json()) as { phoneNumber: string; otp: string }
      expect(message).toEqual({ phoneNumber, otp: expect.stringMatching(/^\d{6}$/) })

      const verifyResponse = await runtime.app.request('/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp: message.otp, sessionMode: 'cookie' }),
      })
      expect(verifyResponse.status).toBe(200)
      const accessCookie = verifyResponse.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('__Host-nexus_access='))
        ?.split(';', 1)[0]

      const generateResponse = await runtime.app.request('/llm/generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: accessCookie ?? '',
          origin: 'https://app.nexus.test',
        },
        body: JSON.stringify({ model: 'standard', prompt: 'Hello locally', maxTokens: 100 }),
      })
      expect(generateResponse.status).toBe(200)
      await expect(generateResponse.json()).resolves.toMatchObject({
        model: 'standard',
        text: 'Local response: Hello locally',
        usage: { inputTokens: 2, outputTokens: 4, totalTokens: 6 },
      })
    } finally {
      await runtime.close()
    }
  })
})
