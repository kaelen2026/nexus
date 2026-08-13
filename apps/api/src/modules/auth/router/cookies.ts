import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

import { type AuthTokenPair, authCookieNames } from '../types.js'

export function getRefreshTokenCookie(context: Context): string | undefined {
  return getCookie(context, authCookieNames.refresh)
}

export function setAuthCookies(context: Context, tokenPair: AuthTokenPair): void {
  setCookie(context, authCookieNames.access, tokenPair.accessToken, {
    httpOnly: true,
    maxAge: 15 * 60,
    path: '/',
    sameSite: 'Lax',
    secure: true,
  })
  setCookie(context, authCookieNames.refresh, tokenPair.refreshToken, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: '/auth/refresh',
    sameSite: 'Lax',
    secure: true,
  })
}

export function cookieSessionResponse(tokenPair: AuthTokenPair) {
  return {
    sessionMode: 'cookie' as const,
    accessTokenExpiresAt: tokenPair.accessTokenExpiresAt.toISOString(),
  }
}
