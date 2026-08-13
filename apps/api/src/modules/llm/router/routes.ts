import { Hono } from 'hono'

import type { GatewayEnvironment } from '../../../gateway/index.js'
import { LlmAccessDeniedError, LlmProviderError } from '../errors.js'
import type { Generate } from '../types.js'
import { generateBodySchema } from './schema.js'

export function createLlmRouter(options: { generate: Generate }): Hono<GatewayEnvironment> {
  const router = new Hono<GatewayEnvironment>()

  router.post('/generate', async (context) => {
    const identity = context.get('requestContext').identity
    if (identity?.type !== 'user') {
      return context.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        401,
      )
    }

    const body = generateBodySchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
        400,
      )
    }

    try {
      return context.json(await options.generate({ userId: identity.subject, ...body.data }))
    } catch (error) {
      if (error instanceof LlmAccessDeniedError) {
        return context.json(
          {
            error: {
              code: 'LLM_ACCESS_DENIED',
              message: 'LLM generation is not available',
            },
          },
          403,
        )
      }
      if (error instanceof LlmProviderError) {
        return context.json(
          {
            error: {
              code: 'LLM_PROVIDER_ERROR',
              message: 'LLM provider is unavailable',
            },
          },
          502,
        )
      }
      throw error
    }
  })

  return router
}
