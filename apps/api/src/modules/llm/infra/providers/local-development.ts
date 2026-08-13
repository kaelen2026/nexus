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
    async stream(input) {
      const text = `Local response: ${input.prompt}`
      return (async function* () {
        yield { type: 'delta' as const, text }
        yield {
          type: 'completed' as const,
          usage: {
            inputTokens: countTokens(input.prompt),
            outputTokens: countTokens(text),
          },
        }
      })()
    },
  }
}
