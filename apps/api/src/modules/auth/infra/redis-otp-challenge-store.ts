import type { createClient } from 'redis'

import type { OtpChallengeStore } from '../types.js'

interface RedisOtpChallengeStoreOptions {
  redis: Pick<ReturnType<typeof createClient>, 'set'>
  keyPrefix?: string
}

export function createRedisOtpChallengeStore(
  options: RedisOtpChallengeStoreOptions,
): OtpChallengeStore {
  const keyPrefix = options.keyPrefix ?? 'auth:otp'

  return {
    async save(challenge) {
      await options.redis.set(`${keyPrefix}:${challenge.phoneNumber}`, challenge.otpHash, {
        expiration: { type: 'PXAT', value: challenge.expiresAt.getTime() },
      })
    },
  }
}
