import { z } from 'zod'

export const sendOtpBodySchema = z.object({
  phoneNumber: z.string().trim().min(8).max(32),
})

export const verifyOtpBodySchema = z.object({
  phoneNumber: z.string().trim().min(8).max(32),
  otp: z.string().regex(/^\d{6}$/),
  sessionMode: z.enum(['token', 'cookie']).optional(),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(32).optional(),
})
