export interface LlmProvider {
  countInputTokens(input: { providerModel: string; prompt: string }): Promise<number>
  generate(input: { providerModel: string; prompt: string; maxTokens: number }): Promise<{
    text: string
    usage: { inputTokens: number; outputTokens: number }
  }>
}
