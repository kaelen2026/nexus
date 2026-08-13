import { z } from 'zod'

export const sendOtpBodySchema = z.object({
  phoneNumber: z.string().trim().min(8).max(32),
})
