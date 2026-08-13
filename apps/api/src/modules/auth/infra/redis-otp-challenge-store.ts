import type { RedisClientType } from 'redis'

import type { OtpChallengeStore } from '../types.js'

interface RedisOtpChallengeStoreOptions {
  redis: Pick<RedisClientType, 'set'>
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
