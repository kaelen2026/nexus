import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPhoneIdentity } from '../../src/modules/auth/index.js'
import { createUsersModule } from '../../src/modules/users/index.js'
import { createInMemoryEventBus } from '../../src/shared/events/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => {
  await migrateDatabase(database.client)
})

beforeEach(async () => {
  await database.client.execute(sql`truncate auth_sessions, auth_accounts, users cascade`)
})

afterAll(async () => {
  await database.close()
})

describe('createPhoneIdentity', () => {
  it('atomically creates a User, Account, and Session on first authentication', async () => {
    const identity = await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    expect(identity.userId).toMatch(/^[0-9a-f-]{36}$/)
    expect(identity.accountId).toMatch(/^[0-9a-f-]{36}$/)
    expect(identity.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await identityCounts()).toEqual({
      users: 1,
      profiles: 1,
      settings: 1,
      accounts: 1,
      sessions: 1,
      pendingEvents: 1,
    })
  })

  it('reuses the User and Account for repeated authentication', async () => {
    const publishUserCreated = vi.fn().mockResolvedValue(undefined)
    const input = {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    }

    const first = await createPhoneIdentity(database.client, input, { publishUserCreated })
    const second = await createPhoneIdentity(database.client, input, { publishUserCreated })

    expect(second.userId).toBe(first.userId)
    expect(second.accountId).toBe(first.accountId)
    expect(second.sessionId).not.toBe(first.sessionId)
    expect(await identityCounts()).toEqual({
      users: 1,
      profiles: 1,
      settings: 1,
      accounts: 1,
      sessions: 2,
      pendingEvents: 1,
    })
    expect(publishUserCreated).toHaveBeenCalledOnce()
    expect(publishUserCreated).toHaveBeenCalledWith(first.userId)
  })

  it('rolls back User and Account when Session creation fails', async () => {
    await expect(
      createPhoneIdentity(database.client, {
        phoneNumber: '+8613800138000',
        sessionExpiresAt: new Date(Number.NaN),
      }),
    ).rejects.toThrow()

    expect(await identityCounts()).toEqual({
      users: 0,
      profiles: 0,
      settings: 0,
      accounts: 0,
      sessions: 0,
      pendingEvents: 0,
    })
  })

  it('replays a durable user-created event after its first delivery fails', async () => {
    const eventBus = createInMemoryEventBus()
    const users = createUsersModule({ database: database.client, eventBus })
    const stopFailing = eventBus.subscribe('users.user-created', async () => {
      throw new Error('billing unavailable')
    })

    await expect(
      createPhoneIdentity(
        database.client,
        {
          phoneNumber: '+8613800138000',
          sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
        },
        { publishUserCreated: users.publishUserCreated },
      ),
    ).rejects.toThrow('billing unavailable')
    expect(await identityCounts()).toEqual({
      users: 1,
      profiles: 1,
      settings: 1,
      accounts: 1,
      sessions: 1,
      pendingEvents: 1,
    })

    stopFailing()
    const delivered = vi.fn().mockResolvedValue(undefined)
    eventBus.subscribe('users.user-created', delivered)
    await users.replayPendingEvents()

    expect(delivered).toHaveBeenCalledOnce()
    expect(delivered).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'users.user-created',
        payload: { userId: expect.any(String) },
      }),
    )
    expect((await identityCounts()).pendingEvents).toBe(0)
  })
})

async function identityCounts() {
  const counts = await database.client.execute<{
    users: number
    profiles: number
    settings: number
    accounts: number
    sessions: number
    pendingEvents: number
  }>(sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from user_profiles) as profiles,
      (select count(*)::int from user_settings) as settings,
      (select count(*)::int from auth_accounts) as accounts,
      (select count(*)::int from auth_sessions) as sessions,
      (select count(*)::int from users_user_created_outbox where published_at is null) as "pendingEvents"
  `)
  const result = counts[0]
  if (!result) throw new Error('Expected identity counts')
  return result
}
