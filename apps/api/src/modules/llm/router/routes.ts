import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import type { GatewayEnvironment } from '../../../gateway/index.js'
import { LlmAccessDeniedError, LlmProviderError } from '../errors.js'
import type { Generate, GenerateStream } from '../types.js'
import { generateBodySchema } from './schema.js'

export function createLlmRouter(options: {
  generate?: Generate
  generateStream?: GenerateStream
}): Hono<GatewayEnvironment> {
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
      if (!options.generate) return context.notFound()
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

  router.post('/generate/stream', async (context) => {
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
    if (!options.generateStream) return context.notFound()

    try {
      const result = await options.generateStream({ userId: identity.subject, ...body.data })
      return streamSSE(context, async (stream) => {
        await stream.writeSSE({
          event: 'start',
          data: JSON.stringify({ requestId: result.requestId, model: result.model }),
        })
        try {
          for await (const event of result.events) {
            if (event.type === 'delta') {
              await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: event.text }) })
            } else {
              await stream.writeSSE({
                event: 'completed',
                data: JSON.stringify({ usage: event.usage }),
              })
            }
          }
        } catch {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: { code: 'LLM_PROVIDER_ERROR', message: 'LLM provider is unavailable' },
            }),
          })
        }
      })
    } catch (error) {
      if (error instanceof LlmAccessDeniedError) {
        return context.json(
          { error: { code: 'LLM_ACCESS_DENIED', message: 'LLM generation is not available' } },
          403,
        )
      }
      if (error instanceof LlmProviderError) {
        return context.json(
          { error: { code: 'LLM_PROVIDER_ERROR', message: 'LLM provider is unavailable' } },
          502,
        )
      }
      throw error
    }
  })

  return router
}
