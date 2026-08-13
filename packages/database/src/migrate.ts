import { fileURLToPath } from 'node:url'

import { migrate } from 'drizzle-orm/postgres-js/migrator'

import type { Database } from './index.js'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

export async function migrateDatabase(client: Database['client']): Promise<void> {
  await migrate(client, { migrationsFolder })
}
