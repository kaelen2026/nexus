import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createPhoneIdentity,
  createRefreshSession,
  revokeAllSessions,
  revokeSession,
} from '../../src/modules/auth/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})
const secret = 'test-token-secret-at-least-32-characters'
const expiresAt = new Date('2030-09-12T00:00:00.000Z')

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(
    sql`truncate auth_refresh_tokens, auth_sessions, auth_accounts, users cascade`,
  )
})
afterAll(async () => database.close())

async function createTwoSessions() {
  const first = await createPhoneIdentity(database.client, {
    phoneNumber: '+8613800138000',
    sessionExpiresAt: expiresAt,
  })
  const second = await createPhoneIdentity(database.client, {
    phoneNumber: '+8613800138000',
    sessionExpiresAt: expiresAt,
  })
  await Promise.all([
    createRefreshSession(database.client, {
      sessionId: first.sessionId,
      secret,
      expiresAt,
    }),
    createRefreshSession(database.client, {
      sessionId: second.sessionId,
      secret,
      expiresAt,
    }),
  ])
  return { first, second }
}

describe('Session revocation', () => {
  it('revokes only the current Session and its Refresh Tokens', async () => {
    const { first, second } = await createTwoSessions()

    await revokeSession(database.client, first.sessionId)

    const rows = await database.client.execute<{ id: string; revoked: boolean }>(sql`
      select s.id, s.revoked_at is not null and bool_and(t.revoked_at is not null) as revoked
      from auth_sessions s
      join auth_refresh_tokens t on t.session_id = s.id
      group by s.id
    `)
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: first.sessionId, revoked: true },
        { id: second.sessionId, revoked: false },
      ]),
    )
  })

  it('revokes every Session and Refresh Token for the User', async () => {
    const { first } = await createTwoSessions()

    await revokeAllSessions(database.client, first.userId)

    const [result] = await database.client.execute<{
      activeSessions: number
      activeTokens: number
    }>(
      sql`
        select
          count(distinct s.id) filter (where s.revoked_at is null)::int as "activeSessions",
          count(t.id) filter (where t.revoked_at is null)::int as "activeTokens"
        from auth_sessions s
        join auth_refresh_tokens t on t.session_id = s.id
        where s.user_id = ${first.userId}
      `,
    )
    expect(result).toEqual({ activeSessions: 0, activeTokens: 0 })
  })
})
