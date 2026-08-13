import { randomUUID } from 'node:crypto'

import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createRedisOtpChallengeStore } from '../../src/modules/auth/infra/redis-otp-challenge-store.js'

const redis = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
})

beforeAll(async () => {
  await redis.connect()
})

afterAll(async () => {
  if (redis.isOpen) await redis.quit()
})

describe('Redis OTP challenge store', () => {
  it('stores only the OTP hash until the challenge expires', async () => {
    const keyPrefix = `test:otp:${randomUUID()}`
    const store = createRedisOtpChallengeStore({ redis, keyPrefix })
    const expiresAt = new Date(Date.now() + 300_000)

    await store.save({
      phoneNumber: '+8613800138000',
      otpHash: 'hashed-otp',
      expiresAt,
    })

    const key = `${keyPrefix}:+8613800138000`
    try {
      expect(await redis.get(key)).toBe('hashed-otp')
      expect(await redis.ttl(key)).toBeGreaterThanOrEqual(299)
      expect(await redis.ttl(key)).toBeLessThanOrEqual(300)
    } finally {
      await redis.del(key)
    }
  })

  it('atomically consumes a matching challenge only once', async () => {
    const keyPrefix = `test:otp:${randomUUID()}`
    const store = createRedisOtpChallengeStore({ redis, keyPrefix })
    const challenge = {
      phoneNumber: '+8613800138000',
      otpHash: 'hashed-otp',
      expiresAt: new Date(Date.now() + 300_000),
    }
    await store.save(challenge)

    expect(await store.consume(challenge.phoneNumber, 'wrong-hash')).toBe(false)
    expect(await store.consume(challenge.phoneNumber, challenge.otpHash)).toBe(true)
    expect(await store.consume(challenge.phoneNumber, challenge.otpHash)).toBe(false)
  })
})
