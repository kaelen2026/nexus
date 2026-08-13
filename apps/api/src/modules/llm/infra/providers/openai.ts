import { z } from 'zod'

import type { LlmProvider, LlmProviderStreamEvent } from './types.js'

const countSchema = z.object({ input_tokens: z.number().int().nonnegative() })
const responseSchema = z.object({
  output_text: z.string(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
})
const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('response.output_text.delta'), delta: z.string() }),
  z.object({
    type: z.literal('response.completed'),
    response: z.object({
      usage: z.object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      }),
    }),
  }),
])

interface OpenAiProviderOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export function createOpenAiLlmProvider(options: OpenAiProviderOptions): LlmProvider {
  const fetch = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1'

  async function post(path: string, body: unknown): Promise<Response> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`)
    return response
  }

  return {
    async countInputTokens(input) {
      const response = await post('/responses/input_tokens', {
        model: input.providerModel,
        input: input.prompt,
      })
      return countSchema.parse(await response.json()).input_tokens
    },
    async generate(input) {
      const response = await post('/responses', {
        model: input.providerModel,
        input: input.prompt,
        max_output_tokens: input.maxTokens,
      })
      const result = responseSchema.parse(await response.json())
      return {
        text: result.output_text,
        usage: {
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
        },
      }
    },
    async stream(input) {
      const response = await post('/responses', {
        model: input.providerModel,
        input: input.prompt,
        max_output_tokens: input.maxTokens,
        stream: true,
      })
      if (!response.body) throw new Error('OpenAI stream response has no body')
      return parseResponseStream(response.body)
    },
  }
}

async function* parseResponseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<LlmProviderStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split(/\r?\n\r?\n/u)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const data = block
          .split(/\r?\n/u)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!data || data === '[DONE]') continue
        const parsed = streamEventSchema.safeParse(JSON.parse(data))
        if (!parsed.success) continue
        if (parsed.data.type === 'response.output_text.delta') {
          yield { type: 'delta', text: parsed.data.delta }
        } else {
          yield {
            type: 'completed',
            usage: {
              inputTokens: parsed.data.response.usage.input_tokens,
              outputTokens: parsed.data.response.usage.output_tokens,
            },
          }
        }
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}
