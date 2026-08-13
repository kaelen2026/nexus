import type { OAuthFlow, OAuthFlowStore } from '../types.js'

const flowTtlSeconds = 10 * 60

export function createRedisOAuthFlowStore(redis: {
  set(key: string, value: string, options: { EX: number }): Promise<unknown>
  getDel(key: string): Promise<string | null>
}): OAuthFlowStore {
  return {
    async save(state, flow) {
      await redis.set(`auth:oauth:${state}`, JSON.stringify(flow), { EX: flowTtlSeconds })
    },
    async consume(state) {
      const serialized = await redis.getDel(`auth:oauth:${state}`)
      if (!serialized) return undefined
      try {
        const flow = JSON.parse(serialized) as Partial<OAuthFlow>
        if (
          (flow.provider !== 'google' && flow.provider !== 'apple') ||
          typeof flow.codeVerifier !== 'string' ||
          typeof flow.nonce !== 'string'
        ) {
          return undefined
        }
        return flow as OAuthFlow
      } catch {
        return undefined
      }
    },
  }
}
