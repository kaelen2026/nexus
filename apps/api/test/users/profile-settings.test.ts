import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createPhoneIdentity } from '../../src/modules/auth/index.js'
import { createUsersModule } from '../../src/modules/users/index.js'
import { createInMemoryEventBus } from '../../src/shared/events/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () =>
  database.client.execute(sql`truncate auth_sessions, auth_accounts, users cascade`),
)
afterAll(async () => database.close())

describe('User profile and settings', () => {
  it('loads defaults and persists partial updates', async () => {
    const identity = await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })
    const users = createUsersModule({
      database: database.client,
      eventBus: createInMemoryEventBus(),
    })

    await expect(users.getProfile(identity.userId)).resolves.toMatchObject({
      userId: identity.userId,
      displayName: null,
      avatarUrl: null,
    })
    await expect(users.getSettings(identity.userId)).resolves.toMatchObject({
      userId: identity.userId,
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
    })

    await expect(
      users.updateProfile({ userId: identity.userId, displayName: 'Kaelen' }),
    ).resolves.toMatchObject({ displayName: 'Kaelen', avatarUrl: null })
    await expect(
      users.updateSettings({ userId: identity.userId, timezone: 'UTC' }),
    ).resolves.toMatchObject({ locale: 'zh-CN', timezone: 'UTC' })
  })
})
