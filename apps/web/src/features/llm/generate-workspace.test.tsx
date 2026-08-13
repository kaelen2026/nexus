import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, type NexusApi } from '@/lib/api-client'
import { GenerateWorkspace } from './generate-workspace'

function createApi(generate: NexusApi['generate']): NexusApi {
  return {
    getCurrentUser: vi.fn(),
    generate,
    logout: vi.fn(),
    logoutAll: vi.fn(),
    deleteAccount: vi.fn(),
  }
}

describe('GenerateWorkspace', () => {
  it('submits a trimmed prompt and displays the generated result with usage', async () => {
    const generate = vi.fn().mockResolvedValue({
      requestId: 'request-id',
      model: 'standard',
      text: '1. 明确发布目标\n2. 完成上线检查',
      usage: { inputTokens: 8, outputTokens: 21, totalTokens: 29 },
    })
    render(<GenerateWorkspace api={createApi(generate)} />)

    fireEvent.change(screen.getByLabelText('你想让 Nexus 做什么？'), {
      target: { value: '  帮我整理一份新产品发布检查清单  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    await waitFor(() =>
      expect(generate).toHaveBeenCalledWith({
        model: 'standard',
        prompt: '帮我整理一份新产品发布检查清单',
        maxTokens: 1_000,
      }),
    )
    expect(await screen.findByText(/明确发布目标/)).toBeInTheDocument()
    expect(screen.getByText('标准模型 · 29 tokens')).toBeInTheDocument()
  })

  it('rejects an empty prompt before calling the API', () => {
    const generate = vi.fn()
    render(<GenerateWorkspace api={createApi(generate)} />)

    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请输入你想生成的内容')
    expect(generate).not.toHaveBeenCalled()
  })

  it('shows a stable message when entitlement or quota is unavailable', async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(new ApiError('LLM_ACCESS_DENIED', '当前账户暂无可用的生成额度'))
    render(<GenerateWorkspace api={createApi(generate)} />)

    fireEvent.change(screen.getByLabelText('你想让 Nexus 做什么？'), {
      target: { value: '生成一个提纲' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('当前账户暂无可用的生成额度')
    expect(screen.queryByText('生成结果')).not.toBeInTheDocument()
  })

  it('returns to login when the session cannot be restored', async () => {
    const navigate = vi.fn()
    const generate = vi.fn().mockRejectedValue(new ApiError('UNAUTHENTICATED', '登录状态已失效'))
    render(<GenerateWorkspace api={createApi(generate)} navigate={navigate} />)

    fireEvent.change(screen.getByLabelText('你想让 Nexus 做什么？'), {
      target: { value: '生成一个提纲' },
    })
    fireEvent.click(screen.getByRole('button', { name: '生成内容' }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'))
  })
})
