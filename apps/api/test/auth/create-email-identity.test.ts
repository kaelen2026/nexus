import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmailIdentity } from '../../src/modules/auth/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(sql`truncate auth_sessions, auth_accounts, users cascade`)
})
afterAll(async () => database.close())

describe('createEmailIdentity', () => {
  it('creates an email Account and reuses it case-insensitively', async () => {
    const publishUserCreated = vi.fn().mockResolvedValue(undefined)
    const first = await createEmailIdentity(
      database.client,
      {
        email: 'Alice@Example.COM',
        sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
      },
      { publishUserCreated },
    )
    const second = await createEmailIdentity(
      database.client,
      {
        email: ' alice@example.com ',
        sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
      },
      { publishUserCreated },
    )

    expect(second.userId).toBe(first.userId)
    expect(second.accountId).toBe(first.accountId)
    expect(second.sessionId).not.toBe(first.sessionId)
    const accounts = await database.client.execute<{ provider: string; subject: string }>(sql`
      select provider, provider_subject as subject from auth_accounts
    `)
    expect(accounts).toEqual([{ provider: 'email', subject: 'alice@example.com' }])
    expect(publishUserCreated).toHaveBeenCalledOnce()
  })
})
