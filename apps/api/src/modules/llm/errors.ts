export class LlmAccessDeniedError extends Error {
  constructor() {
    super('LLM generation is not available for this user')
    this.name = 'LlmAccessDeniedError'
  }
}
