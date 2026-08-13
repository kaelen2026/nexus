import type { createClient } from 'redis'

import { createOtpHasher, generateOtp as generateSecureOtp } from './infra/otp.js'
import { createRedisOtpChallengeStore } from './infra/redis-otp-challenge-store.js'
import { createSendOtp } from './service/send-otp.js'
import { createVerifyOtp } from './service/verify-otp.js'
import type { SmsSender } from './types.js'

interface AuthModuleOptions {
  generateOtp?: () => string
  otpHashSecret: string
  otpTtlSeconds?: number
  redis: ReturnType<typeof createClient>
  smsSender: SmsSender
}

export function createAuthModule(options: AuthModuleOptions) {
  const challengeStore = createRedisOtpChallengeStore({ redis: options.redis })
  const hashOtp = createOtpHasher(options.otpHashSecret)

  return {
    sendOtp: createSendOtp({
      clock: { now: () => new Date() },
      challengeStore,
      generateOtp: options.generateOtp ?? generateSecureOtp,
      hashOtp,
      smsSender: options.smsSender,
      ttlSeconds: options.otpTtlSeconds ?? 300,
    }),
    verifyOtp: createVerifyOtp({ challengeStore, hashOtp }),
  }
}
