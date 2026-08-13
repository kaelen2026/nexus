import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

import { type AuthenticateAccessToken, authCookieNames } from '../../modules/auth/index.js'
import type { GatewayEnvironment } from '../context/types.js'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined
  const match = /^Bearer ([^\s]+)$/i.exec(authorization)
  return match?.[1]
}

export function createAuthenticationMiddleware(options: {
  authenticateAccessToken: AuthenticateAccessToken
  trustedOrigins?: string[]
}) {
  const trustedOrigins = new Set(options.trustedOrigins ?? [])

  return createMiddleware<GatewayEnvironment>(async (context, next) => {
    const authorization = context.req.header('authorization')
    const headerToken = bearerToken(authorization)
    const accessCookie = getCookie(context, authCookieNames.access)
    const refreshCookie = getCookie(context, authCookieNames.refresh)
    const usesCookieCredentials = !authorization && Boolean(accessCookie || refreshCookie)

    if (usesCookieCredentials && !safeMethods.has(context.req.method)) {
      const origin = context.req.header('origin')
      if (!origin || !trustedOrigins.has(origin)) {
        return context.json(
          { error: { code: 'INVALID_ORIGIN', message: 'Invalid request origin' } },
          403,
        )
      }
    }

    if (authorization && !headerToken) {
      return context.json(
        { error: { code: 'INVALID_ACCESS_TOKEN', message: 'Invalid access token' } },
        401,
      )
    }

    const token = headerToken ?? accessCookie
    if (!token) {
      await next()
      return
    }

    let identity: Awaited<ReturnType<AuthenticateAccessToken>>
    try {
      identity = await options.authenticateAccessToken(token)
    } catch {
      return context.json(
        { error: { code: 'INVALID_ACCESS_TOKEN', message: 'Invalid access token' } },
        401,
      )
    }
    context.set('requestContext', { ...context.get('requestContext'), identity })
    await next()
  })
}
