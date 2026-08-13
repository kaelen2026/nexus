import { Hono } from 'hono'

import type { GatewayEnvironment } from '../../../gateway/index.js'
import {
  InvalidCredentialsError,
  InvalidOtpError,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from '../errors.js'
import type {
  LoginWithEmailPassword,
  Logout,
  LogoutAll,
  RefreshSession,
  ResetEmailPassword,
  SendEmailOtp,
  SendOtp,
  VerifyEmailOtp,
  VerifyPhoneOtp,
} from '../types.js'
import {
  clearAuthCookies,
  cookieSessionResponse,
  getRefreshTokenCookie,
  setAuthCookies,
} from './cookies.js'
import {
  loginEmailPasswordBodySchema,
  refreshBodySchema,
  resetEmailPasswordBodySchema,
  sendEmailOtpBodySchema,
  sendOtpBodySchema,
  verifyEmailOtpBodySchema,
  verifyOtpBodySchema,
} from './schema.js'

export function createAuthRouter(options: {
  sendOtp?: SendOtp
  sendEmailOtp?: SendEmailOtp
  verifyEmailOtp?: VerifyEmailOtp
  verifyPhoneOtp?: VerifyPhoneOtp
  refreshSession?: RefreshSession
  logout?: Logout
  logoutAll?: LogoutAll
  loginWithEmailPassword?: LoginWithEmailPassword
  resetEmailPassword?: ResetEmailPassword
}): Hono<GatewayEnvironment> {
  const router = new Hono<GatewayEnvironment>()

  if (options.loginWithEmailPassword)
    router.post('/email/password/login', async (context) => {
      const body = loginEmailPasswordBodySchema.safeParse(
        await context.req.json().catch(() => null),
      )
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }
      try {
        const { sessionMode, ...input } = body.data
        const tokenPair = await options.loginWithEmailPassword?.(input)
        if (!tokenPair) throw new Error('Email password login is not configured')
        if (sessionMode === 'cookie') {
          setAuthCookies(context, tokenPair)
          return context.json(cookieSessionResponse(tokenPair))
        }
        return context.json(tokenPair)
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return context.json(
            {
              error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
              },
            },
            401,
          )
        }
        throw error
      }
    })

  if (options.resetEmailPassword)
    router.post('/email/password/reset', async (context) => {
      const body = resetEmailPasswordBodySchema.safeParse(
        await context.req.json().catch(() => null),
      )
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }
      try {
        await options.resetEmailPassword?.(body.data)
        return context.body(null, 204)
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

  if (options.sendEmailOtp)
    router.post('/email/otp/send', async (context) => {
      const body = sendEmailOtpBodySchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }
      const result = await options.sendEmailOtp?.(body.data)
      if (!result) throw new Error('Send email OTP is not configured')
      return context.json({ expiresAt: result.expiresAt.toISOString() }, 202)
    })

  if (options.verifyEmailOtp)
    router.post('/email/otp/verify', async (context) => {
      const body = verifyEmailOtpBodySchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }
      try {
        const { sessionMode, ...input } = body.data
        const tokenPair = await options.verifyEmailOtp?.(input)
        if (!tokenPair) throw new Error('Verify email OTP is not configured')
        if (sessionMode === 'cookie') {
          setAuthCookies(context, tokenPair)
          return context.json(cookieSessionResponse(tokenPair))
        }
        return context.json(tokenPair)
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
        const { sessionMode, ...input } = body.data
        const tokenPair = await options.verifyPhoneOtp?.(input)
        if (!tokenPair) throw new Error('Verify OTP is not configured')
        if (sessionMode === 'cookie') {
          setAuthCookies(context, tokenPair)
          return context.json(cookieSessionResponse(tokenPair))
        }
        return context.json(tokenPair)
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
      const body = refreshBodySchema.safeParse(await context.req.json().catch(() => ({})))
      const cookieRefreshToken = getRefreshTokenCookie(context)
      const refreshToken = body.success ? (body.data.refreshToken ?? cookieRefreshToken) : undefined
      if (!body.success || !refreshToken) {
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      }

      try {
        const tokenPair = await options.refreshSession?.({ refreshToken })
        if (!tokenPair) throw new Error('Refresh Session is not configured')
        if (cookieRefreshToken) {
          setAuthCookies(context, tokenPair)
          return context.json(cookieSessionResponse(tokenPair))
        }
        return context.json(tokenPair)
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

  if (options.logout)
    router.post('/logout', async (context) => {
      const identity = context.get('requestContext').identity
      if (identity?.type !== 'user' || !identity.sessionId) {
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      }
      await options.logout?.({ sessionId: identity.sessionId })
      clearAuthCookies(context)
      return context.body(null, 204)
    })

  if (options.logoutAll)
    router.post('/logout-all', async (context) => {
      const identity = context.get('requestContext').identity
      if (identity?.type !== 'user') {
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      }
      await options.logoutAll?.({ userId: identity.subject })
      clearAuthCookies(context)
      return context.body(null, 204)
    })

  return router
}
