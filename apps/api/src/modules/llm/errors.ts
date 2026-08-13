export class LlmAccessDeniedError extends Error {
  constructor() {
    super('LLM generation is not available for this user')
    this.name = 'LlmAccessDeniedError'
  }
}

export class LlmProviderError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('LLM provider is unavailable', options)
    this.name = 'LlmProviderError'
  }
}
