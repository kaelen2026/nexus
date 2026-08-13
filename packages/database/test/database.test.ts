import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { createDatabase, migrateDatabase } from '../src/index.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
})

afterAll(async () => {
  await database.close()
})

describe('database', () => {
  it('connects to PostgreSQL and executes a query', async () => {
    const result = await database.client.execute<{ value: number }>(sql`select 1 as value`)

    expect(result[0]?.value).toBe(1)
  })

  it('applies module-owned schemas and constraints', async () => {
    await migrateDatabase(database.client)

    const tables = await database.client.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'users', 'auth_accounts', 'auth_sessions',
          'billing_plans', 'billing_plan_entitlements', 'billing_plan_quotas',
          'billing_subscriptions', 'billing_event_receipts',
          'billing_usage_records', 'billing_usage_reservations', 'llm_requests'
        )
      order by table_name
    `)

    expect(tables.map((row) => row.table_name)).toEqual([
      'auth_accounts',
      'auth_sessions',
      'billing_event_receipts',
      'billing_plan_entitlements',
      'billing_plan_quotas',
      'billing_plans',
      'billing_subscriptions',
      'billing_usage_records',
      'billing_usage_reservations',
      'llm_requests',
      'users',
    ])

    const constraints = await database.client.execute<{ constraint_name: string }>(sql`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and constraint_name in (
          'auth_accounts_provider_subject_unique',
          'auth_accounts_user_id_users_id_fk',
          'auth_sessions_account_id_auth_accounts_id_fk',
          'auth_sessions_user_id_users_id_fk'
        )
      order by constraint_name
    `)

    expect(constraints.map((row) => row.constraint_name)).toEqual([
      'auth_accounts_provider_subject_unique',
      'auth_accounts_user_id_users_id_fk',
      'auth_sessions_account_id_auth_accounts_id_fk',
      'auth_sessions_user_id_users_id_fk',
    ])
  })
})
