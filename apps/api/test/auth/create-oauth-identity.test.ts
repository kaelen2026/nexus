import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createOAuthIdentity } from '../../src/modules/auth/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(sql`truncate auth_sessions, auth_accounts, users cascade`)
})
afterAll(async () => database.close())

describe('createOAuthIdentity', () => {
  it.each(['google', 'apple'] as const)(
    'creates and then reuses a %s Account by its stable provider subject',
    async (provider) => {
      const publishUserCreated = vi.fn().mockResolvedValue(undefined)
      const input = {
        provider,
        providerSubject: `${provider}-subject`,
        sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
      }

      const first = await createOAuthIdentity(database.client, input, { publishUserCreated })
      const second = await createOAuthIdentity(database.client, input, { publishUserCreated })

      expect(second).toMatchObject({ userId: first.userId, accountId: first.accountId })
      expect(second.sessionId).not.toBe(first.sessionId)
      const [counts] = await database.client.execute<{
        users: number
        accounts: number
        sessions: number
      }>(sql`
        select
          (select count(*)::int from users) as users,
          (select count(*)::int from auth_accounts where provider = ${provider}) as accounts,
          (select count(*)::int from auth_sessions) as sessions
      `)
      expect(counts).toEqual({ users: 1, accounts: 1, sessions: 2 })
      expect(publishUserCreated).toHaveBeenCalledOnce()
    },
  )
})
