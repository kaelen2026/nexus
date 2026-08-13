import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'

const databaseOptionsSchema = z.object({
  url: z.url(),
  maxConnections: z.number().int().positive().optional(),
})

export type DatabaseOptions = z.infer<typeof databaseOptionsSchema>

export function createDatabase(options: DatabaseOptions) {
  const parsedOptions = databaseOptionsSchema.parse(options)
  const connection = postgres(parsedOptions.url, {
    max: parsedOptions.maxConnections ?? 10,
  })

  return {
    client: drizzle(connection),
    close: () => connection.end(),
  }
}

export type Database = ReturnType<typeof createDatabase>

export { migrateDatabase } from './migrate.js'
