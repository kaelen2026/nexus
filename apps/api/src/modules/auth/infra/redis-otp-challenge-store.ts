import type { createClient } from 'redis'

import type { OtpChallengeStore } from '../types.js'

interface RedisOtpChallengeStoreOptions {
  redis: Pick<ReturnType<typeof createClient>, 'eval' | 'set'>
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
    async consume(phoneNumber, otpHash) {
      const result = await options.redis.eval(
        `
          if redis.call('GET', KEYS[1]) == ARGV[1] then
            redis.call('DEL', KEYS[1])
            return 1
          end
          return 0
        `,
        {
          keys: [`${keyPrefix}:${phoneNumber}`],
          arguments: [otpHash],
        },
      )

      return result === 1
    },
  }
}
