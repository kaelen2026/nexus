import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'
import { UserNotFoundError, UserSuspendedError } from '../../src/modules/users/index.js'

const identity = {
  type: 'user' as const,
  subject: 'user-id',
  accountId: 'account-id',
  roles: [],
  scopes: [],
}

describe('GET /users/me', () => {
  it('returns the stable current User from the authenticated identity', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue({
      id: 'user-id',
      status: 'active',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T01:00:00.000Z'),
    })
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      getCurrentUser,
    })

    const response = await app.request('/users/me', {
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(200)
    expect(getCurrentUser).toHaveBeenCalledWith('user-id')
    await expect(response.json()).resolves.toEqual({
      id: 'user-id',
      status: 'active',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T01:00:00.000Z',
    })
  })

  it('rejects an unauthenticated request without calling Users', async () => {
    const getCurrentUser = vi.fn()
    const app = createApp({ getCurrentUser })

    const response = await app.request('/users/me')

    expect(response.status).toBe(401)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('forbids a suspended User', async () => {
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      getCurrentUser: vi.fn().mockRejectedValue(new UserSuspendedError()),
    })

    const response = await app.request('/users/me', {
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'USER_SUSPENDED', message: 'User is suspended' },
    })
  })

  it('does not expose a deleted or missing User', async () => {
    const app = createApp({
      authenticateAccessToken: vi.fn().mockResolvedValue(identity),
      getCurrentUser: vi.fn().mockRejectedValue(new UserNotFoundError()),
    })

    const response = await app.request('/users/me', {
      headers: { authorization: 'Bearer access-token' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    })
  })
})
