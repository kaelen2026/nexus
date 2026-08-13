import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { NexusApi } from '@/lib/api-client'
import { SessionActions } from './session-actions'

function renderActions(api: NexusApi, navigate = vi.fn()) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['current-user'], { id: 'user-id' })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  render(<SessionActions api={api} navigate={navigate} />, { wrapper })
  return { navigate, queryClient }
}

function createApi(overrides: Partial<NexusApi> = {}): NexusApi {
  return {
    getCurrentUser: vi.fn(),
    generate: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('SessionActions', () => {
  it('logs out the current session, clears cached user data, and navigates to login', async () => {
    const api = createApi()
    const { navigate, queryClient } = renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '退出当前设备' }))

    await waitFor(() => expect(api.logout).toHaveBeenCalledOnce())
    expect(queryClient.getQueryData(['current-user'])).toBeUndefined()
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('requires confirmation before logging out every session', async () => {
    const api = createApi()
    const { navigate } = renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '退出所有设备' }))

    expect(screen.getByRole('dialog', { name: '退出所有设备？' })).toBeInTheDocument()
    expect(api.logoutAll).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认退出所有设备' }))

    await waitFor(() => expect(api.logoutAll).toHaveBeenCalledOnce())
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('stays on the current page and offers retry when logout fails', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('暂时无法连接服务，请稍后重试'))
    const api = createApi({ logout })
    const { navigate } = renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '退出当前设备' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法连接服务，请稍后重试')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '重试退出' })).toBeInTheDocument()
  })

  it('closes the confirmation and retries logout-all after a failure', async () => {
    const logoutAll = vi
      .fn()
      .mockRejectedValueOnce(new Error('请求失败，请稍后重试'))
      .mockResolvedValueOnce(undefined)
    const api = createApi({ logoutAll })
    const { navigate } = renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '退出所有设备' }))
    fireEvent.click(screen.getByRole('button', { name: '确认退出所有设备' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请求失败，请稍后重试')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试退出' }))

    await waitFor(() => expect(logoutAll).toHaveBeenCalledTimes(2))
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('requires explicit confirmation before deleting the account', async () => {
    const api = createApi()
    const { navigate, queryClient } = renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '注销账号' }))

    expect(screen.getByRole('dialog', { name: '注销账号？' })).toHaveTextContent(
      '账户将被永久停用，所有设备都会退出，且无法再次登录。',
    )
    expect(api.deleteAccount).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认注销账号' }))

    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledOnce())
    expect(queryClient.getQueryData(['current-user'])).toBeUndefined()
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('keeps the account active when deletion is cancelled', () => {
    const api = createApi()
    renderActions(api)

    fireEvent.click(screen.getByRole('button', { name: '账户菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '注销账号' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.deleteAccount).not.toHaveBeenCalled()
  })
})
