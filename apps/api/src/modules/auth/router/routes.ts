import { Hono } from 'hono'

import { InvalidOtpError, InvalidRefreshTokenError, RefreshTokenReuseError } from '../errors.js'
import type { RefreshSession, SendOtp, VerifyPhoneOtp } from '../types.js'
import { refreshBodySchema, sendOtpBodySchema, verifyOtpBodySchema } from './schema.js'

export function createAuthRouter(options: {
  sendOtp?: SendOtp
  verifyPhoneOtp?: VerifyPhoneOtp
  refreshSession?: RefreshSession
}): Hono {
  const router = new Hono()

  if (options.sendOtp)
    router.post('/otp/send', async (context) => {
      const body = sendOtpBodySchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }

      const result = await options.sendOtp?.(body.data)
      if (!result) throw new Error('Send OTP is not configured')

      return context.json({ expiresAt: result.expiresAt.toISOString() }, 202)
    })

  if (options.verifyPhoneOtp)
    router.post('/otp/verify', async (context) => {
      const body = verifyOtpBodySchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }

      try {
        return context.json(await options.verifyPhoneOtp?.(body.data))
      } catch (error) {
        if (error instanceof InvalidOtpError) {
          return context.json(
            { error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' } },
            401,
          )
        }
        throw error
      }
    })

  if (options.refreshSession)
    router.post('/refresh', async (context) => {
      const body = refreshBodySchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }

      try {
        return context.json(await options.refreshSession?.(body.data))
      } catch (error) {
        if (error instanceof InvalidRefreshTokenError || error instanceof RefreshTokenReuseError) {
          return context.json(
            { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' } },
            401,
          )
        }
        throw error
      }
    })

  return router
}
