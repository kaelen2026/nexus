import type { DatabaseClient } from '@nexus/database'

import { createOtpHasher, generateOtp as generateSecureOtp } from './infra/otp.js'
import { createAuthRedis } from './infra/redis.js'
import { createRedisOAuthFlowStore } from './infra/redis-oauth-flow-store.js'
import { createRedisOtpChallengeStore } from './infra/redis-otp-challenge-store.js'
import { createAccessTokenService } from './infra/token.js'
import { authenticate } from './service/authenticate.js'
import { completeEmailAuthentication } from './service/complete-email-authentication.js'
import { completePhoneAuthentication } from './service/complete-phone-authentication.js'
import { createOAuthIdentity } from './service/create-oauth-identity.js'
import { createEmailIdentity } from './service/create-email-identity.js'
import { createPhoneIdentity } from './service/create-phone-identity.js'
import { createSendEmailOtp, createVerifyEmailOtp } from './service/email-otp.js'
import { revokeAllSessions, revokeSession } from './service/logout.js'
import { createOAuthService } from './service/oauth.js'
import { createRefreshSession, rotateRefreshToken } from './service/refresh-token.js'
import { createSendOtp } from './service/send-otp.js'
import { createVerifyOtp } from './service/verify-otp.js'
import type {
  AuthTokenPair,
  EmailSender,
  OAuthProvider,
  OAuthProviderId,
  SmsSender,
} from './types.js'

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
  oauthProviders?: OAuthProvider[]
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
  const oauth = createOAuthService({
    flowStore: createRedisOAuthFlowStore(redis.client),
    providers: options.oauthProviders ?? [],
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

  return {
    ...emailOtp,
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
    startOAuth: (input: { provider: OAuthProviderId }) => oauth.start(input.provider),
    completeOAuth: async (input: { provider: OAuthProviderId; code: string; state: string }) => {
      const providerIdentity = await oauth.complete(input)
      const sessionExpiresAt = new Date(Date.now() + sessionTtlMilliseconds)
      const identity = await createOAuthIdentity(
        options.database,
        {
          provider: input.provider,
          providerSubject: providerIdentity.providerSubject,
          sessionExpiresAt,
        },
        {
          ...(options.publishUserCreated ? { publishUserCreated: options.publishUserCreated } : {}),
        },
      )
      const { refreshToken } = await createRefreshSession(options.database, {
        sessionId: identity.sessionId,
        secret: options.tokenSecret,
        expiresAt: sessionExpiresAt,
      })
      return issueTokenPair(identity, refreshToken)
    },
    close: redis.close,
  }
}
