import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createPhoneIdentity,
  createRefreshSession,
  RefreshTokenReuseError,
  rotateRefreshToken,
} from '../../src/modules/auth/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})
const tokenSecret = 'test-token-secret-at-least-32-characters'

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(
    sql`truncate auth_refresh_tokens, auth_sessions, auth_accounts, users cascade`,
  )
})
afterAll(async () => database.close())

describe('refresh token rotation', () => {
  it('stores only hashes and rotates a refresh token once', async () => {
    const identity = await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })
    const initial = await createRefreshSession(database.client, {
      sessionId: identity.sessionId,
      secret: tokenSecret,
      expiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    const rotated = await rotateRefreshToken(database.client, {
      refreshToken: initial.refreshToken,
      secret: tokenSecret,
      expiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    expect(rotated.refreshToken).not.toBe(initial.refreshToken)
    const stored = await database.client.execute<{ tokenHash: string }>(
      sql`select token_hash as "tokenHash" from auth_refresh_tokens order by created_at`,
    )
    expect(stored).toHaveLength(2)
    expect(stored.every((row) => row.tokenHash !== initial.refreshToken)).toBe(true)
    expect(stored.every((row) => row.tokenHash !== rotated.refreshToken)).toBe(true)
  })

  it('revokes the Session when an already rotated token is reused', async () => {
    const identity = await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })
    const initial = await createRefreshSession(database.client, {
      sessionId: identity.sessionId,
      secret: tokenSecret,
      expiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })
    const rotated = await rotateRefreshToken(database.client, {
      refreshToken: initial.refreshToken,
      secret: tokenSecret,
      expiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    await expect(
      rotateRefreshToken(database.client, {
        refreshToken: initial.refreshToken,
        secret: tokenSecret,
        expiresAt: new Date('2026-09-12T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(RefreshTokenReuseError)
    await expect(
      rotateRefreshToken(database.client, {
        refreshToken: rotated.refreshToken,
        secret: tokenSecret,
        expiresAt: new Date('2026-09-12T00:00:00.000Z'),
      }),
    ).rejects.toThrow()

    const [revocation] = await database.client.execute<{
      sessionRevoked: boolean
      activeTokens: number
    }>(sql`
      select
        s.revoked_at is not null as "sessionRevoked",
        count(*) filter (where t.revoked_at is null)::int as "activeTokens"
      from auth_sessions s
      join auth_refresh_tokens t on t.session_id = s.id
      where s.id = ${identity.sessionId}
      group by s.id
    `)
    expect(revocation).toEqual({ sessionRevoked: true, activeTokens: 0 })
  })
})
