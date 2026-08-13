import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose'

import type { OAuthProvider } from '../../types.js'

const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))

export function createAppleOAuthProvider(options: {
  clientId: string
  keyId: string
  teamId: string
  privateKey: string
  redirectUri: string
  fetch?: typeof fetch
}): OAuthProvider {
  const fetcher = options.fetch ?? fetch

  async function createClientSecret() {
    const key = await importPKCS8(options.privateKey.replaceAll('\\n', '\n'), 'ES256')
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: options.keyId })
      .setIssuer(options.teamId)
      .setSubject(options.clientId)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key)
  }

  return {
    id: 'apple',
    createAuthorizationUrl({ state, nonce }) {
      const url = new URL('https://appleid.apple.com/auth/authorize')
      url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name email',
        state,
        nonce,
      }).toString()
      return url
    },
    async exchangeCode({ code, nonce }) {
      const response = await fetcher('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: options.clientId,
          client_secret: await createClientSecret(),
          redirect_uri: options.redirectUri,
          grant_type: 'authorization_code',
          code,
        }),
      })
      if (!response.ok) throw new Error('Apple token exchange failed')
      const tokens = (await response.json()) as { id_token?: string }
      if (!tokens.id_token) throw new Error('Apple ID token missing')
      const { payload } = await jwtVerify(tokens.id_token, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: options.clientId,
      })
      if (!payload.sub || payload.nonce !== nonce) throw new Error('Invalid Apple identity')
      return { providerSubject: payload.sub }
    },
  }
}
