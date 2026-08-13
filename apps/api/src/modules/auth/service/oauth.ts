import { createHash, randomBytes } from 'node:crypto'

import { InvalidOAuthCallbackError, OAuthProviderUnavailableError } from '../errors.js'
import type { OAuthFlowStore, OAuthProvider, OAuthProviderId } from '../types.js'

function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function createOAuthService(options: {
  flowStore: OAuthFlowStore
  providers: OAuthProvider[]
}) {
  const providers = new Map(options.providers.map((provider) => [provider.id, provider]))

  return {
    async start(providerId: OAuthProviderId): Promise<string> {
      const provider = providers.get(providerId)
      if (!provider) throw new OAuthProviderUnavailableError()
      const state = randomBase64Url()
      const nonce = randomBase64Url()
      const codeVerifier = randomBase64Url(48)
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
      await options.flowStore.save(state, { provider: providerId, codeVerifier, nonce })
      return provider.createAuthorizationUrl({ state, nonce, codeChallenge }).toString()
    },

    async complete(input: { provider: OAuthProviderId; code: string; state: string }) {
      const flow = await options.flowStore.consume(input.state)
      const provider = providers.get(input.provider)
      if (!flow || flow.provider !== input.provider || !provider) {
        throw new InvalidOAuthCallbackError()
      }
      try {
        return await provider.exchangeCode({
          code: input.code,
          codeVerifier: flow.codeVerifier,
          nonce: flow.nonce,
        })
      } catch {
        throw new InvalidOAuthCallbackError()
      }
    },
  }
}
