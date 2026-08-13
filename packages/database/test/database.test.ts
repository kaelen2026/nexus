import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { createDatabase } from '../src/index.js'

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
})
