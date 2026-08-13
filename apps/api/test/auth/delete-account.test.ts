import { createDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  AccountDisabledError,
  createPhoneIdentity,
  deleteAccount,
} from '../../src/modules/auth/index.js'

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus'
const database = createDatabase({ url: databaseUrl })

beforeEach(async () => {
  await database.client.execute(
    sql`truncate auth_refresh_tokens, auth_sessions, auth_accounts, users cascade`,
  )
})

afterAll(async () => {
  await database.close()
})

describe('deleteAccount', () => {
  it('disables every Account, revokes every Session, and marks the User deleted', async () => {
    const expiresAt = new Date('2026-09-12T00:00:00.000Z')
    const first = await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: expiresAt,
    })
    await createPhoneIdentity(database.client, {
      phoneNumber: '+8613800138000',
      sessionExpiresAt: expiresAt,
    })

    await deleteAccount(database.client, { userId: first.userId })

    const [state] = await database.client.execute<{
      userStatus: string
      activeAccounts: number
      activeSessions: number
    }>(sql`
      select
        u.status as "userStatus",
        count(distinct a.id) filter (where a.status = 'active')::int as "activeAccounts",
        count(distinct s.id) filter (where s.revoked_at is null)::int as "activeSessions"
      from users u
      left join auth_accounts a on a.user_id = u.id
      left join auth_sessions s on s.user_id = u.id
      where u.id = ${first.userId}
      group by u.id
    `)
    expect(state).toEqual({ userStatus: 'deleted', activeAccounts: 0, activeSessions: 0 })

    await expect(
      createPhoneIdentity(database.client, {
        phoneNumber: '+8613800138000',
        sessionExpiresAt: expiresAt,
      }),
    ).rejects.toBeInstanceOf(AccountDisabledError)
  })
})
