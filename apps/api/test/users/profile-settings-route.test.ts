import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../../src/app.js'

const identity = {
  type: 'user' as const,
  subject: 'user-id',
  accountId: 'account-id',
  sessionId: 'session-id',
  roles: [],
  scopes: [],
}

const getCurrentUser = vi.fn()
const authentication = () => vi.fn().mockResolvedValue(identity)

describe('User profile routes', () => {
  it('gets the authenticated User profile', async () => {
    const getProfile = vi.fn().mockResolvedValue({
      userId: 'user-id',
      displayName: null,
      avatarUrl: null,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
    })
    const app = createApp({
      authenticateAccessToken: authentication(),
      getCurrentUser,
      getProfile,
    })

    const response = await app.request('/users/me/profile', {
      headers: { authorization: 'Bearer token' },
    })

    expect(response.status).toBe(200)
    expect(getProfile).toHaveBeenCalledWith('user-id')
    await expect(response.json()).resolves.toMatchObject({
      userId: 'user-id',
      displayName: null,
      avatarUrl: null,
    })
  })

  it('validates and updates the authenticated User profile', async () => {
    const updateProfile = vi.fn().mockResolvedValue({
      userId: 'user-id',
      displayName: 'Kaelen',
      avatarUrl: 'https://cdn.nexus.test/avatar.png',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T01:00:00.000Z'),
    })
    const app = createApp({
      authenticateAccessToken: authentication(),
      getCurrentUser,
      updateProfile,
    })

    const response = await app.request('/users/me/profile', {
      method: 'PATCH',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Kaelen',
        avatarUrl: 'https://cdn.nexus.test/avatar.png',
      }),
    })

    expect(response.status).toBe(200)
    expect(updateProfile).toHaveBeenCalledWith({
      userId: 'user-id',
      displayName: 'Kaelen',
      avatarUrl: 'https://cdn.nexus.test/avatar.png',
    })
  })
})

describe('User settings routes', () => {
  it('gets and updates the authenticated User settings', async () => {
    const getSettings = vi.fn().mockResolvedValue({
      userId: 'user-id',
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
    })
    const updateSettings = vi.fn().mockResolvedValue({
      userId: 'user-id',
      locale: 'en-US',
      timezone: 'UTC',
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T01:00:00.000Z'),
    })
    const app = createApp({
      authenticateAccessToken: authentication(),
      getCurrentUser,
      getSettings,
      updateSettings,
    })

    const getResponse = await app.request('/users/me/settings', {
      headers: { authorization: 'Bearer token' },
    })
    expect(getResponse.status).toBe(200)
    expect(getSettings).toHaveBeenCalledWith('user-id')

    const patchResponse = await app.request('/users/me/settings', {
      method: 'PATCH',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'en-US', timezone: 'UTC' }),
    })
    expect(patchResponse.status).toBe(200)
    expect(updateSettings).toHaveBeenCalledWith({
      userId: 'user-id',
      locale: 'en-US',
      timezone: 'UTC',
    })
  })

  it('requires authentication and rejects empty updates', async () => {
    const updateSettings = vi.fn()
    const app = createApp({ getCurrentUser, updateSettings })

    const unauthenticated = await app.request('/users/me/settings', { method: 'PATCH' })
    expect(unauthenticated.status).toBe(401)

    const authenticatedApp = createApp({
      authenticateAccessToken: authentication(),
      getCurrentUser,
      updateSettings,
    })
    const invalid = await authenticatedApp.request('/users/me/settings', {
      method: 'PATCH',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(invalid.status).toBe(400)
    expect(updateSettings).not.toHaveBeenCalled()
  })
})
