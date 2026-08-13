import { createRemoteJWKSet, jwtVerify } from 'jose'

import type { OAuthProvider } from '../../types.js'

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export function createGoogleOAuthProvider(options: {
  clientId: string
  clientSecret: string
  redirectUri: string
  fetch?: typeof fetch
}): OAuthProvider {
  const fetcher = options.fetch ?? fetch
  return {
    id: 'google',
    createAuthorizationUrl({ state, nonce, codeChallenge }) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString()
      return url
    },
    async exchangeCode({ code, codeVerifier, nonce }) {
      const response = await fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: options.clientId,
          client_secret: options.clientSecret,
          redirect_uri: options.redirectUri,
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
        }),
      })
      if (!response.ok) throw new Error('Google token exchange failed')
      const tokens = (await response.json()) as { id_token?: string }
      if (!tokens.id_token) throw new Error('Google ID token missing')
      const { payload } = await jwtVerify(tokens.id_token, googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: options.clientId,
      })
      if (!payload.sub || payload.nonce !== nonce) throw new Error('Invalid Google identity')
      return { providerSubject: payload.sub }
    },
  }
}
