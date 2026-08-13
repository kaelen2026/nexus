export interface LlmProvider {
  generate(input: { providerModel: string; prompt: string; maxTokens: number }): Promise<{
    text: string
    usage: { inputTokens: number; outputTokens: number }
  }>
}
