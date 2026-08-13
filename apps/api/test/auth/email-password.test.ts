import { createDatabase, migrateDatabase } from '@nexus/database'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createEmailPasswordLogin,
  createResetEmailPassword,
  InvalidCredentialsError,
} from '../../src/modules/auth/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

beforeAll(async () => migrateDatabase(database.client))
beforeEach(async () => {
  await database.client.execute(
    sql`truncate auth_refresh_tokens, auth_sessions, auth_credentials, auth_accounts, users cascade`,
  )
})
afterAll(async () => database.close())

describe('email password authentication', () => {
  it('creates a verified email identity with a password, then logs in', async () => {
    const consumeOtp = vi.fn().mockResolvedValue(undefined)
    const hash = vi.fn().mockResolvedValue('password-hash')
    const reset = createResetEmailPassword({ database: database.client, consumeOtp, hash })

    await reset({
      email: ' Alice@Example.COM ',
      otp: '123456',
      newPassword: 'correct horse battery staple',
    })

    const login = createEmailPasswordLogin({
      database: database.client,
      verify: vi.fn().mockResolvedValue(true),
    })
    const identity = await login({
      email: 'alice@example.com',
      password: 'correct horse battery staple',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    expect(consumeOtp).toHaveBeenCalledWith({ email: ' Alice@Example.COM ', otp: '123456' })
    expect(hash).toHaveBeenCalledWith('correct horse battery staple')
    expect(identity).toEqual({
      userId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      accountId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('rejects unknown email and wrong password identically', async () => {
    const login = createEmailPasswordLogin({
      database: database.client,
      verify: vi.fn().mockResolvedValue(false),
    })

    await expect(
      login({
        email: 'missing@example.com',
        password: 'incorrect password',
        sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('revokes existing sessions when replacing a password', async () => {
    const reset = createResetEmailPassword({
      database: database.client,
      consumeOtp: vi.fn().mockResolvedValue(undefined),
      hash: vi.fn().mockResolvedValueOnce('old-hash').mockResolvedValueOnce('new-hash'),
    })
    await reset({ email: 'alice@example.com', otp: '123456', newPassword: 'old password value' })
    const login = createEmailPasswordLogin({
      database: database.client,
      verify: vi.fn().mockResolvedValue(true),
    })
    await login({
      email: 'alice@example.com',
      password: 'old password value',
      sessionExpiresAt: new Date('2026-09-12T00:00:00.000Z'),
    })

    await reset({ email: 'alice@example.com', otp: '654321', newPassword: 'new password value' })

    const rows = await database.client.execute<{ active: number }>(sql`
      select count(*) filter (where revoked_at is null)::int as active from auth_sessions
    `)
    expect(rows[0]).toEqual({ active: 0 })
  })
})
