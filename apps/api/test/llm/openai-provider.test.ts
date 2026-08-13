import { describe, expect, it, vi } from 'vitest'

import { createOpenAiLlmProvider } from '../../src/modules/llm/index.js'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

describe('OpenAI LLM provider', () => {
  it('uses the Responses token-count endpoint and normalizes a response', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ object: 'response.input_tokens', input_tokens: 7 }))
      .mockResolvedValueOnce(
        jsonResponse({ output_text: 'Hello back', usage: { input_tokens: 7, output_tokens: 4 } }),
      )
    const provider = createOpenAiLlmProvider({ apiKey: 'secret', fetch })

    await expect(
      provider.countInputTokens({ providerModel: 'gpt-test', prompt: 'Hello' }),
    ).resolves.toBe(7)
    await expect(
      provider.generate({ providerModel: 'gpt-test', prompt: 'Hello', maxTokens: 20 }),
    ).resolves.toEqual({ text: 'Hello back', usage: { inputTokens: 7, outputTokens: 4 } })
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.openai.com/v1/responses/input_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer secret' }),
        body: JSON.stringify({ model: 'gpt-test', input: 'Hello' }),
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({ model: 'gpt-test', input: 'Hello', max_output_tokens: 20 }),
      }),
    )
  })

  it('converts Responses SSE text deltas and completion usage', async () => {
    const body = [
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello "}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"back"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":4}}}\n\n',
    ]
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of body) controller.enqueue(new TextEncoder().encode(chunk))
            controller.close()
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
    )
    const provider = createOpenAiLlmProvider({ apiKey: 'secret', fetch })

    const stream = await provider.stream?.({
      providerModel: 'gpt-test',
      prompt: 'Hello',
      maxTokens: 20,
    })
    const events = []
    for await (const event of stream ?? []) events.push(event)

    expect(events).toEqual([
      { type: 'delta', text: 'Hello ' },
      { type: 'delta', text: 'back' },
      { type: 'completed', usage: { inputTokens: 7, outputTokens: 4 } },
    ])
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'gpt-test',
          input: 'Hello',
          max_output_tokens: 20,
          stream: true,
        }),
      }),
    )
  })
})
