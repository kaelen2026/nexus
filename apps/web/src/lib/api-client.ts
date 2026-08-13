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

const generateResponseSchema = z.object({
  requestId: z.string().min(1),
  model: z.literal('standard'),
  text: z.string(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
})

export type CurrentUser = z.infer<typeof currentUserSchema>
export type GenerateResult = z.infer<typeof generateResponseSchema>
export interface GenerateInput {
  model: 'standard'
  prompt: string
  maxTokens: number
}

export interface NexusApi {
  getCurrentUser(): Promise<CurrentUser>
  generate(input: GenerateInput): Promise<GenerateResult>
  logout(): Promise<void>
  logoutAll(): Promise<void>
  deleteAccount(): Promise<void>
}

const errorMessages: Record<string, string> = {
  UNAUTHENTICATED: '登录状态已失效',
  USER_SUSPENDED: '账户已暂停',
  USER_NOT_FOUND: '未找到用户',
  INVALID_REQUEST: '请求内容无效，请检查后重试',
  LLM_ACCESS_DENIED: '当前账户暂无可用的生成额度',
  LLM_PROVIDER_ERROR: '生成服务暂时不可用，请稍后重试',
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
  method?: 'GET' | 'POST' | 'DELETE'
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

    const payload: unknown =
      response.status === 204 ? undefined : await response.json().catch(() => null)
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
    generate: (input) =>
      request('/llm/generate', {
        method: 'POST',
        body: input,
        schema: generateResponseSchema,
      }),
    logout: () =>
      request('/auth/logout', {
        method: 'POST',
        schema: z.void(),
        refreshOnUnauthorized: false,
      }),
    logoutAll: () =>
      request('/auth/logout-all', {
        method: 'POST',
        schema: z.void(),
        refreshOnUnauthorized: false,
      }),
    deleteAccount: () =>
      request('/users/me', {
        method: 'DELETE',
        schema: z.void(),
        refreshOnUnauthorized: false,
      }),
  }
}

export const apiClient = createApiClient()
