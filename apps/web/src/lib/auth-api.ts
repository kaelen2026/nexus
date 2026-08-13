import { z } from 'zod'

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const sendOtpResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
})

const cookieSessionResponseSchema = z.object({
  sessionMode: z.literal('cookie'),
  accessTokenExpiresAt: z.iso.datetime(),
})

export interface AuthApi {
  sendOtp(input: { phoneNumber: string }): Promise<z.infer<typeof sendOtpResponseSchema>>
  verifyOtp(input: {
    phoneNumber: string
    otp: string
    sessionMode: 'cookie'
  }): Promise<z.infer<typeof cookieSessionResponseSchema>>
  sendEmailOtp(input: { email: string }): Promise<z.infer<typeof sendOtpResponseSchema>>
  verifyEmailOtp(input: {
    email: string
    otp: string
    sessionMode: 'cookie'
  }): Promise<z.infer<typeof cookieSessionResponseSchema>>
}

const errorMessages: Record<string, string> = {
  INVALID_OTP: '验证码无效或已过期',
  INVALID_REQUEST: '请求内容无效，请检查后重试',
}

async function request<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
  let response: Response

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('暂时无法连接服务，请稍后重试')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const apiError = apiErrorSchema.safeParse(payload)
    const code = apiError.success ? apiError.data.error.code : undefined
    throw new Error((code && errorMessages[code]) || '请求失败，请稍后重试')
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) throw new Error('服务响应异常，请稍后重试')
  return parsed.data
}

export const authApi: AuthApi = {
  sendOtp: (input) => request('/auth/otp/send', input, sendOtpResponseSchema),
  verifyOtp: (input) => request('/auth/otp/verify', input, cookieSessionResponseSchema),
  sendEmailOtp: (input) => request('/auth/email/otp/send', input, sendOtpResponseSchema),
  verifyEmailOtp: (input) => request('/auth/email/otp/verify', input, cookieSessionResponseSchema),
}
