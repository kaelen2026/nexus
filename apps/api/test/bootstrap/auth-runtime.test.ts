import { createDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { createClient } from 'redis'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiRuntime } from '../../src/bootstrap/runtime.js'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus'
const inspector = createClient({ url: redisUrl })
const database = createDatabase({ url: databaseUrl })

beforeAll(async () => {
  await inspector.connect()
})

beforeEach(async () => {
  await database.client.execute(sql`truncate auth_sessions, auth_accounts, users cascade`)
})

afterAll(async () => {
  await inspector.quit()
  await database.close()
})

describe('Auth runtime composition', () => {
  it('wires the HTTP route through Redis and closes owned resources', async () => {
    const sendSms = vi.fn()
    const runtime = await createApiRuntime({
      env: {
        DATABASE_URL: databaseUrl,
        OTP_HASH_SECRET: 'test-secret-at-least-32-characters',
        REDIS_URL: redisUrl,
        TOKEN_SECRET: 'test-token-secret-at-least-32-characters',
        TRUSTED_ORIGINS: 'https://app.nexus.test',
      },
      generateOtp: () => '123456',
      smsSender: { sendOtp: sendSms },
    })

    try {
      const response = await runtime.app.request('/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+8613800138000' }),
      })

      expect(response.status).toBe(202)
      expect(sendSms).toHaveBeenCalledWith({ phoneNumber: '+8613800138000', otp: '123456' })
      expect(await inspector.get('auth:otp:+8613800138000')).toMatch(/^[a-f0-9]{64}$/)

      const verifyResponse = await runtime.app.request('/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: '+8613800138000',
          otp: '123456',
          sessionMode: 'cookie',
        }),
      })
      expect(verifyResponse.status).toBe(200)
      const tokenPair = await verifyResponse.json()
      expect(tokenPair).toEqual({
        sessionMode: 'cookie',
        accessTokenExpiresAt: expect.any(String),
      })
      const refreshCookie = verifyResponse.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('__Secure-nexus_refresh='))
        ?.split(';', 1)[0]
      expect(refreshCookie).toBeDefined()
      const accessCookie = verifyResponse.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('__Host-nexus_access='))
        ?.split(';', 1)[0]
      expect(accessCookie).toBeDefined()

      const currentUserResponse = await runtime.app.request('/users/me', {
        headers: { cookie: accessCookie ?? '' },
      })
      expect(currentUserResponse.status).toBe(200)
      await expect(currentUserResponse.json()).resolves.toEqual({
        id: expect.any(String),
        status: 'active',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })

      const refreshResponse = await runtime.app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          cookie: refreshCookie ?? '',
          origin: 'https://app.nexus.test',
        },
      })
      expect(refreshResponse.status).toBe(200)
      const refreshedTokenPair = await refreshResponse.json()
      expect(refreshedTokenPair).toEqual({
        sessionMode: 'cookie',
        accessTokenExpiresAt: expect.any(String),
      })
      expect(refreshResponse.headers.getSetCookie()).toHaveLength(2)

      const replayResponse = await runtime.app.request('/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+8613800138000', otp: '123456' }),
      })
      expect(replayResponse.status).toBe(401)
    } finally {
      await runtime.close()
      await runtime.close()
      await inspector.del('auth:otp:+8613800138000')
    }
  })
})
