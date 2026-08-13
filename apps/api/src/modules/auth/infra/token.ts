import { createHmac, randomBytes } from 'node:crypto'

import { jwtVerify, SignJWT } from 'jose'

const encoder = new TextEncoder()

function validateSecret(secret: string): Uint8Array {
  if (secret.length < 32) throw new Error('Token secret must be at least 32 characters')
  return encoder.encode(secret)
}

interface AccessTokenOptions {
  issuer: string
  audience: string
  secret: string
  ttlSeconds: number
}

interface AccessTokenIdentity {
  userId: string
  accountId: string
  sessionId: string
}

export function createAccessTokenService(options: AccessTokenOptions) {
  const key = validateSecret(options.secret)

  return {
    issue(identity: AccessTokenIdentity, now = new Date()): Promise<string> {
      const issuedAt = Math.floor(now.getTime() / 1_000)
      return new SignJWT({ accountId: identity.accountId, sessionId: identity.sessionId })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(identity.userId)
        .setIssuer(options.issuer)
        .setAudience(options.audience)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + options.ttlSeconds)
        .sign(key)
    },
    async verify(token: string, now = new Date()) {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: options.issuer,
        audience: options.audience,
        currentDate: now,
      })
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.accountId !== 'string' ||
        typeof payload.sessionId !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Access token is missing required identity claims')
      }

      return {
        userId: payload.sub,
        accountId: payload.accountId,
        sessionId: payload.sessionId,
        expiresAt: new Date(payload.exp * 1_000),
      }
    },
  }
}

export function createRefreshTokenService(secret: string) {
  validateSecret(secret)

  return {
    generate: () => randomBytes(32).toString('base64url'),
    hash: (token: string) => createHmac('sha256', secret).update(token).digest('hex'),
  }
}
