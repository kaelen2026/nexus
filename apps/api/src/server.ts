import { serve } from '@hono/node-server'

import { createLocalDevelopmentRuntime } from './bootstrap/local-development.js'

const port = Number(process.env.PORT ?? 3000)
const runtime = await createLocalDevelopmentRuntime({ env: process.env })
const server = serve({ fetch: runtime.app.fetch, hostname: '127.0.0.1', port })
let isClosing = false

async function close() {
  if (isClosing) return
  isClosing = true
  server.close()
  await runtime.close()
}

process.once('SIGINT', close)
process.once('SIGTERM', close)
