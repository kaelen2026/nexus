import type { LlmProvider } from './types.js'

function countTokens(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length
}

export function createLocalDevelopmentLlmProvider(): LlmProvider {
  return {
    async countInputTokens(input) {
      return countTokens(input.prompt)
    },
    async generate(input) {
      const text = `Local response: ${input.prompt}`
      return {
        text,
        usage: {
          inputTokens: countTokens(input.prompt),
          outputTokens: countTokens(text),
        },
      }
    },
  }
}
