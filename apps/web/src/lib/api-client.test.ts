import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, createApiClient } from './api-client'

const currentUser = {
  id: 'user-id',
  status: 'active' as const,
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T01:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shares one refresh across concurrent unauthenticated requests and retries each once', async () => {
    let userRequests = 0
    let refreshRequests = 0
    let finishRefresh: (() => void) | undefined
    const refreshGate = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) {
        refreshRequests += 1
        await refreshGate
        return jsonResponse({
          sessionMode: 'cookie',
          accessTokenExpiresAt: '2026-08-13T08:15:00.000Z',
        })
      }
      if (url.endsWith('/users/me')) {
        userRequests += 1
        return userRequests <= 2
          ? jsonResponse(
              { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
              401,
            )
          : jsonResponse(currentUser)
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const api = createApiClient()

    const first = api.getCurrentUser()
    const second = api.getCurrentUser()
    await vi.waitFor(() => expect(refreshRequests).toBe(1))
    finishRefresh?.()

    await expect(Promise.all([first, second])).resolves.toEqual([currentUser, currentUser])
    expect(refreshRequests).toBe(1)
    expect(userRequests).toBe(4)
  })

  it('does not loop when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' } },
          401,
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(createApiClient().getCurrentUser()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('preserves a suspended user error for the UI', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'USER_SUSPENDED', message: 'User is suspended' } }, 403),
        ),
    )

    await expect(createApiClient().getCurrentUser()).rejects.toEqual(
      new ApiError('USER_SUSPENDED', '账户已暂停'),
    )
  })

  it('generates text with the authenticated cookie session', async () => {
    const result = {
      requestId: 'request-id',
      model: 'standard' as const,
      text: '整理后的发布检查清单',
      usage: { inputTokens: 8, outputTokens: 21, totalTokens: 29 },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(result))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createApiClient().generate({
        model: 'standard',
        prompt: '整理发布检查清单',
        maxTokens: 1_000,
      }),
    ).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/llm/generate',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          model: 'standard',
          prompt: '整理发布检查清单',
          maxTokens: 1_000,
        }),
      }),
    )
  })

  it('emits text deltas and resolves final usage from a generation stream', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          'event: start\ndata: {"requestId":"request-id","model":"standard"}\n\n' +
            'event: delta\ndata: {"text":"Hello "}\n\n' +
            'event: delta\ndata: {"text":"back"}\n\n' +
            'event: completed\ndata: {"usage":{"inputTokens":2,"outputTokens":3,"totalTokens":5}}\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const deltas: string[] = []
    const generateStream = createApiClient().generateStream
    expect(generateStream).toBeDefined()
    if (!generateStream) throw new Error('Expected streaming client')

    await expect(
      generateStream({ model: 'standard', prompt: 'Hello', maxTokens: 100 }, (text) =>
        deltas.push(text),
      ),
    ).resolves.toEqual({
      requestId: 'request-id',
      model: 'standard',
      text: 'Hello back',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    })
    expect(deltas).toEqual(['Hello ', 'back'])
  })

  it.each([
    ['logout', '/auth/logout'],
    ['logoutAll', '/auth/logout-all'],
  ] as const)('calls %s with cookie credentials', async (method, path) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient()[method]()

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000${path}`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('deletes the current account with cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient().deleteAccount()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/users/me',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
  })
})
