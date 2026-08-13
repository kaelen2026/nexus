import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, type NexusApi } from '@/lib/api-client'
import { CurrentUserHome } from './current-user-home'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )
}

function createApi(getCurrentUser: NexusApi['getCurrentUser']): NexusApi {
  return {
    getCurrentUser,
    logout: vi.fn(),
    logoutAll: vi.fn(),
  }
}

describe('CurrentUserHome', () => {
  it('loads and displays the authoritative current user', async () => {
    const api = createApi(
      vi.fn().mockResolvedValue({
        id: 'user-id',
        status: 'active',
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T01:00:00.000Z',
      }),
    )
    render(<CurrentUserHome api={api} />, { wrapper })

    expect(screen.getByText('正在读取账户')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
    expect(screen.getByText('user-id')).toBeInTheDocument()
    expect(screen.getByText('正常')).toBeInTheDocument()
    expect(screen.getByText('2026-08-13 00:00 UTC')).toBeInTheDocument()
  })

  it('redirects to login after refresh cannot restore the session', async () => {
    const navigate = vi.fn()
    const api = createApi(
      vi.fn().mockRejectedValue(new ApiError('UNAUTHENTICATED', '登录状态已失效')),
    )
    render(<CurrentUserHome api={api} navigate={navigate} />, { wrapper })

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
    expect(screen.queryByRole('heading', { name: '欢迎回来' })).not.toBeInTheDocument()
  })

  it('shows a suspended account state without redirecting', async () => {
    const navigate = vi.fn()
    const api = createApi(vi.fn().mockRejectedValue(new ApiError('USER_SUSPENDED', '账户已暂停')))
    render(<CurrentUserHome api={api} navigate={navigate} />, { wrapper })

    expect(await screen.findByRole('heading', { name: '账户已暂停' })).toBeInTheDocument()
    expect(screen.getByText('此账户暂时无法使用 Nexus。')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
