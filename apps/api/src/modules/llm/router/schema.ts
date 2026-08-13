import { z } from 'zod'

export const generateBodySchema = z.object({
  model: z.literal('standard'),
  prompt: z.string().trim().min(1).max(100_000),
  maxTokens: z.number().int().min(1).max(100_000),
})
