import type { createClient } from 'redis'

import { createOtpHasher, generateOtp as generateSecureOtp } from './infra/otp.js'
import { createRedisOtpChallengeStore } from './infra/redis-otp-challenge-store.js'
import { createSendOtp } from './service/send-otp.js'
import type { SmsSender } from './types.js'

interface AuthModuleOptions {
  generateOtp?: () => string
  otpHashSecret: string
  otpTtlSeconds?: number
  redis: ReturnType<typeof createClient>
  smsSender: SmsSender
}

export function createAuthModule(options: AuthModuleOptions) {
  return {
    sendOtp: createSendOtp({
      clock: { now: () => new Date() },
      challengeStore: createRedisOtpChallengeStore({ redis: options.redis }),
      generateOtp: options.generateOtp ?? generateSecureOtp,
      hashOtp: createOtpHasher(options.otpHashSecret),
      smsSender: options.smsSender,
      ttlSeconds: options.otpTtlSeconds ?? 300,
    }),
  }
}
