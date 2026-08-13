import { createClient } from 'redis'

export async function createAuthRedis(url: string) {
  const client = createClient({ url })
  await client.connect()

  return {
    client,
    async close() {
      if (client.isOpen) await client.quit()
    },
  }
}
