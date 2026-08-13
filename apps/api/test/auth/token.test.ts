import { describe, expect, it } from 'vitest'

import {
  createAccessTokenService,
  createRefreshTokenService,
} from '../../src/modules/auth/infra/token.js'

const secret = 'test-token-secret-at-least-32-characters'

describe('Auth tokens', () => {
  it('issues and verifies a short-lived access token with stable identity claims', async () => {
    const tokens = createAccessTokenService({
      issuer: 'nexus',
      audience: 'nexus-api',
      secret,
      ttlSeconds: 900,
    })
    const now = new Date('2026-08-13T00:00:00.000Z')

    const accessToken = await tokens.issue(
      { userId: 'user-id', accountId: 'account-id', sessionId: 'session-id' },
      now,
    )
    const claims = await tokens.verify(accessToken, now)

    expect(claims).toEqual({
      userId: 'user-id',
      accountId: 'account-id',
      sessionId: 'session-id',
      expiresAt: new Date('2026-08-13T00:15:00.000Z'),
    })
  })

  it('creates an opaque refresh token and a deterministic non-plaintext hash', () => {
    const tokens = createRefreshTokenService(secret)

    const refreshToken = tokens.generate()
    const hash = tokens.hash(refreshToken)

    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain(refreshToken)
    expect(tokens.hash(refreshToken)).toBe(hash)
  })

  it('rejects an expired access token', async () => {
    const tokens = createAccessTokenService({
      issuer: 'nexus',
      audience: 'nexus-api',
      secret,
      ttlSeconds: 1,
    })
    const accessToken = await tokens.issue(
      { userId: 'user-id', accountId: 'account-id', sessionId: 'session-id' },
      new Date('2026-08-13T00:00:00.000Z'),
    )

    await expect(tokens.verify(accessToken, new Date('2026-08-13T00:00:02.000Z'))).rejects.toThrow()
  })

  it('rejects short token secrets', () => {
    expect(() =>
      createAccessTokenService({
        issuer: 'nexus',
        audience: 'nexus-api',
        secret: 'short',
        ttlSeconds: 900,
      }),
    ).toThrow('Token secret must be at least 32 characters')
    expect(() => createRefreshTokenService('short')).toThrow(
      'Token secret must be at least 32 characters',
    )
  })
})
