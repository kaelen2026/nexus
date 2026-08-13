import type { DatabaseClient } from '@nexus/database'

import { createOtpHasher, generateOtp as generateSecureOtp } from './infra/otp.js'
import { createAuthRedis } from './infra/redis.js'
import { createRedisOtpChallengeStore } from './infra/redis-otp-challenge-store.js'
import { completePhoneAuthentication } from './service/complete-phone-authentication.js'
import { createPhoneIdentity } from './service/create-phone-identity.js'
import { createSendOtp } from './service/send-otp.js'
import { createVerifyOtp } from './service/verify-otp.js'
import type { SmsSender } from './types.js'

interface AuthModuleOptions {
  database: DatabaseClient
  generateOtp?: () => string
  otpHashSecret: string
  otpTtlSeconds?: number
  redisUrl: string
  smsSender: SmsSender
}

export async function createAuthModule(options: AuthModuleOptions) {
  const redis = await createAuthRedis(options.redisUrl)
  const challengeStore = createRedisOtpChallengeStore({ redis: redis.client })
  const hashOtp = createOtpHasher(options.otpHashSecret)
  const verifyOtp = createVerifyOtp({ challengeStore, hashOtp })

  return {
    sendOtp: createSendOtp({
      clock: { now: () => new Date() },
      challengeStore,
      generateOtp: options.generateOtp ?? generateSecureOtp,
      hashOtp,
      smsSender: options.smsSender,
      ttlSeconds: options.otpTtlSeconds ?? 300,
    }),
    verifyPhoneOtp: (input: { phoneNumber: string; otp: string }) =>
      completePhoneAuthentication(
        {
          consumeOtp: verifyOtp,
          createIdentity: (identityInput) => createPhoneIdentity(options.database, identityInput),
        },
        {
          ...input,
          sessionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
        },
      ),
    close: redis.close,
  }
}
