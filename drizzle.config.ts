import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./apps/api/src/modules/*/repo/schema.ts'],
  out: './packages/database/migrations',
})
