import { Hono } from 'hono'

import type { SendOtp } from '../types.js'
import { sendOtpBodySchema } from './schema.js'

export function createAuthRouter(sendOtp: SendOtp): Hono {
  const router = new Hono()

  router.post('/otp/send', async (context) => {
    const body = sendOtpBodySchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
        400,
      )
    }

    const result = await sendOtp(body.data)

    return context.json({ expiresAt: result.expiresAt.toISOString() }, 202)
  })

  return router
}
