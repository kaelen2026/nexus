import { z } from 'zod'

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const currentUserSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['active', 'suspended', 'deleted']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const cookieSessionResponseSchema = z.object({
  sessionMode: z.literal('cookie'),
  accessTokenExpiresAt: z.iso.datetime(),
})

export type CurrentUser = z.infer<typeof currentUserSchema>

export interface NexusApi {
  getCurrentUser(): Promise<CurrentUser>
}

const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: '登录状态已失效',
  USER_SUSPENDED: '账户已暂停',
  USER_NOT_FOUND: '未找到用户',
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST'
  body?: unknown
  schema: z.ZodType<T>
  refreshOnUnauthorized?: boolean
}

export function createApiClient(): NexusApi {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'
  let refreshPromise: Promise<void> | undefined

  async function refreshSession(): Promise<void> {
    if (!refreshPromise) {
      refreshPromise = request('/auth/refresh', {
        method: 'POST',
        body: {},
        schema: cookieSessionResponseSchema,
        refreshOnUnauthorized: false,
      })
        .then(() => undefined)
        .finally(() => {
          refreshPromise = undefined
        })
    }
    return refreshPromise
  }

  async function request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        ...(options.body !== undefined
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options.body),
            }
          : {}),
      })
    } catch {
      throw new ApiError('NETWORK_ERROR', '暂时无法连接服务，请稍后重试')
    }

    const payload: unknown = await response.json().catch(() => null)
    if (response.status === 401 && options.refreshOnUnauthorized !== false) {
      try {
        await refreshSession()
      } catch {
        throw new ApiError('UNAUTHENTICATED', errorMessages.UNAUTHENTICATED)
      }
      return request(path, { ...options, refreshOnUnauthorized: false })
    }

    if (!response.ok) {
      const parsedError = apiErrorSchema.safeParse(payload)
      const code = parsedError.success ? parsedError.data.error.code : 'UNKNOWN_ERROR'
      throw new ApiError(code, errorMessages[code] ?? '请求失败，请稍后重试')
    }

    const parsed = options.schema.safeParse(payload)
    if (!parsed.success) throw new ApiError('INVALID_RESPONSE', '服务响应异常，请稍后重试')
    return parsed.data
  }

  return {
    getCurrentUser: () => request('/users/me', { schema: currentUserSchema }),
  }
}

export const apiClient = createApiClient()
