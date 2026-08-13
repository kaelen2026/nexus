export interface BillingUsageAccess {
  getEntitlement(input: { userId: string; key: string }): Promise<boolean>
  reserveUsage(input: {
    userId: string
    key: string
    units: number
  }): Promise<{ reservationId: string } | null>
  commitUsage(input: { reservationId: string; actualUnits: number }): Promise<void>
  releaseUsage(input: { reservationId: string }): Promise<void>
}

export interface GenerateInput {
  userId: string
  model: 'standard'
  prompt: string
  maxTokens: number
}

export interface GenerateResult {
  model: 'standard'
  text: string
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
}
