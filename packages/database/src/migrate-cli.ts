import { createDatabase } from './index.js'
import { migrateDatabase } from './migrate.js'

const database = createDatabase({
  url: process.env.DATABASE_URL ?? 'postgresql://nexus:nexus@localhost:5432/nexus',
  maxConnections: 1,
})

try {
  await migrateDatabase(database.client)
} finally {
  await database.close()
}
