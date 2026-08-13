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
})
