import type { DatabaseClient } from '@nexus/database'

import { createOtpHasher, generateOtp as generateSecureOtp } from './infra/otp.js'
import { createPasswordService } from './infra/password.js'
import { createAuthRedis } from './infra/redis.js'
import { createRedisOtpChallengeStore } from './infra/redis-otp-challenge-store.js'
import { createAccessTokenService } from './infra/token.js'
import { authenticate } from './service/authenticate.js'
import { completeEmailAuthentication } from './service/complete-email-authentication.js'
import { completePhoneAuthentication } from './service/complete-phone-authentication.js'
import { createEmailIdentity } from './service/create-email-identity.js'
import { createPhoneIdentity } from './service/create-phone-identity.js'
import { createSendEmailOtp, createVerifyEmailOtp } from './service/email-otp.js'
import { createEmailPasswordLogin, createResetEmailPassword } from './service/email-password.js'
import { revokeAllSessions, revokeSession } from './service/logout.js'
import { createRefreshSession, rotateRefreshToken } from './service/refresh-token.js'
import { createSendOtp } from './service/send-otp.js'
import { createVerifyOtp } from './service/verify-otp.js'
import type { AuthTokenPair, EmailSender, SmsSender } from './types.js'

const accessTokenTtlSeconds = 15 * 60
const sessionTtlMilliseconds = 30 * 24 * 60 * 60 * 1_000

interface AuthModuleOptions {
  database: DatabaseClient
  generateOtp?: () => string
  otpHashSecret: string
  otpTtlSeconds?: number
  redisUrl: string
  smsSender: SmsSender
  emailSender?: EmailSender
  tokenSecret: string
  publishUserCreated?: (userId: string) => Promise<void>
}

export async function createAuthModule(options: AuthModuleOptions) {
  const redis = await createAuthRedis(options.redisUrl)
  const challengeStore = createRedisOtpChallengeStore({
    redis: redis.client,
    keyPrefix: 'auth:otp:phone',
  })
  const emailChallengeStore = createRedisOtpChallengeStore({
    redis: redis.client,
    keyPrefix: 'auth:otp:email',
  })
  const hashOtp = createOtpHasher(options.otpHashSecret)
  const verifyOtp = createVerifyOtp({ challengeStore, hashOtp })
  const verifyEmailOtpChallenge = createVerifyEmailOtp({
    challengeStore: emailChallengeStore,
    hashOtp,
  })
  const accessTokens = createAccessTokenService({
    issuer: 'nexus',
    audience: 'nexus-api',
    secret: options.tokenSecret,
    ttlSeconds: accessTokenTtlSeconds,
  })
  const passwords = createPasswordService()

  async function issueTokenPair(
    identity: { userId: string; accountId: string; sessionId: string },
    refreshToken: string,
  ): Promise<AuthTokenPair> {
    const now = new Date()
    return {
      tokenType: 'Bearer',
      accessToken: await accessTokens.issue(identity, now),
      accessTokenExpiresAt: new Date(
        (Math.floor(now.getTime() / 1_000) + accessTokenTtlSeconds) * 1_000,
      ),
      refreshToken,
    }
  }

  const emailOtp = options.emailSender
    ? {
        sendEmailOtp: createSendEmailOtp({
          clock: { now: () => new Date() },
          challengeStore: emailChallengeStore,
          emailSender: options.emailSender,
          generateOtp: options.generateOtp ?? generateSecureOtp,
          hashOtp,
          ttlSeconds: options.otpTtlSeconds ?? 300,
        }),
        verifyEmailOtp: async (input: { email: string; otp: string }) => {
          const sessionExpiresAt = new Date(Date.now() + sessionTtlMilliseconds)
          const identity = await completeEmailAuthentication(
            {
              consumeOtp: verifyEmailOtpChallenge,
              createIdentity: (identityInput) =>
                createEmailIdentity(options.database, identityInput, {
                  ...(options.publishUserCreated
                    ? { publishUserCreated: options.publishUserCreated }
                    : {}),
                }),
            },
            { ...input, sessionExpiresAt },
          )
          const { refreshToken } = await createRefreshSession(options.database, {
            sessionId: identity.sessionId,
            secret: options.tokenSecret,
            expiresAt: sessionExpiresAt,
          })
          return issueTokenPair(identity, refreshToken)
        },
      }
    : {}

  async function createTokenPairForIdentity(identity: {
    userId: string
    accountId: string
    sessionId: string
  }) {
    const { refreshToken } = await createRefreshSession(options.database, {
      sessionId: identity.sessionId,
      secret: options.tokenSecret,
      expiresAt: new Date(Date.now() + sessionTtlMilliseconds),
    })
    return issueTokenPair(identity, refreshToken)
  }

  const loginWithPassword = createEmailPasswordLogin({
    database: options.database,
    verify: passwords.verify,
  })

  return {
    ...emailOtp,
    loginWithEmailPassword: async (input: { email: string; password: string }) => {
      const identity = await loginWithPassword({
        ...input,
        sessionExpiresAt: new Date(Date.now() + sessionTtlMilliseconds),
      })
      return createTokenPairForIdentity(identity)
    },
    ...(options.emailSender
      ? {
          resetEmailPassword: createResetEmailPassword({
            database: options.database,
            consumeOtp: verifyEmailOtpChallenge,
            hash: passwords.hash,
            ...(options.publishUserCreated
              ? { publishUserCreated: options.publishUserCreated }
              : {}),
          }),
        }
      : {}),
    authenticateAccessToken: (token: string) =>
      authenticate(options.database, accessTokens.verify, token),
    logout: (input: { sessionId: string }) => revokeSession(options.database, input.sessionId),
    logoutAll: (input: { userId: string }) => revokeAllSessions(options.database, input.userId),
    sendOtp: createSendOtp({
      clock: { now: () => new Date() },
      challengeStore,
      generateOtp: options.generateOtp ?? generateSecureOtp,
      hashOtp,
      smsSender: options.smsSender,
      ttlSeconds: options.otpTtlSeconds ?? 300,
    }),
    verifyPhoneOtp: async (input: { phoneNumber: string; otp: string }) => {
      const sessionExpiresAt = new Date(Date.now() + sessionTtlMilliseconds)
      const identity = await completePhoneAuthentication(
        {
          consumeOtp: verifyOtp,
          createIdentity: (identityInput) =>
            createPhoneIdentity(options.database, identityInput, {
              ...(options.publishUserCreated
                ? { publishUserCreated: options.publishUserCreated }
                : {}),
            }),
        },
        {
          ...input,
          sessionExpiresAt,
        },
      )
      const { refreshToken } = await createRefreshSession(options.database, {
        sessionId: identity.sessionId,
        secret: options.tokenSecret,
        expiresAt: sessionExpiresAt,
      })
      return issueTokenPair(identity, refreshToken)
    },
    refreshSession: async (input: { refreshToken: string }) => {
      const { identity, refreshToken } = await rotateRefreshToken(options.database, {
        refreshToken: input.refreshToken,
        secret: options.tokenSecret,
        expiresAt: new Date(Date.now() + sessionTtlMilliseconds),
      })
      return issueTokenPair(identity, refreshToken)
    },
    close: redis.close,
  }
}
