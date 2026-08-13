'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, LoaderCircleIcon, LogOutIcon, MonitorXIcon, XIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { apiClient, type NexusApi } from '@/lib/api-client'

const defaultNavigate = (path: string) => window.location.assign(path)

interface SessionActionsProps {
  api?: NexusApi
  navigate?: (path: string) => void
}

export function SessionActions({
  api = apiClient,
  navigate = defaultNavigate,
}: SessionActionsProps) {
  const queryClient = useQueryClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [pendingAction, setPendingAction] = useState<'current' | 'all'>()
  const [failedAction, setFailedAction] = useState<'current' | 'all'>()
  const [error, setError] = useState<string>()

  async function logout(action: 'current' | 'all') {
    setPendingAction(action)
    setFailedAction(undefined)
    setError(undefined)
    try {
      await (action === 'current' ? api.logout() : api.logoutAll())
      queryClient.clear()
      navigate('/login')
    } catch (cause) {
      setFailedAction(action)
      setError(cause instanceof Error ? cause.message : '退出失败，请稍后重试')
    } finally {
      setPendingAction(undefined)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        onClick={() => setIsMenuOpen((open) => !open)}
        className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        账户菜单
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {isMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-background p-2 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pendingAction)}
            onClick={() => logout('current')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
          >
            <LogOutIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            退出当前设备
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pendingAction)}
            onClick={() => {
              setIsMenuOpen(false)
              setConfirmAll(true)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-destructive outline-none hover:bg-destructive/5 focus-visible:bg-destructive/5 disabled:opacity-50"
          >
            <MonitorXIcon className="size-4" aria-hidden="true" />
            退出所有设备
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="absolute right-0 top-12 z-10 w-72 rounded-xl border border-destructive/25 bg-background p-4 text-sm shadow-lg"
        >
          <p className="text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => logout(failedAction ?? 'current')}
          >
            重试退出
          </Button>
        </div>
      ) : null}

      {confirmAll ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-foreground/20 px-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-all-heading"
            className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="logout-all-heading" className="text-xl font-semibold tracking-tight">
                  退出所有设备？
                </h2>
                <p className="mt-3 leading-6 text-muted-foreground">
                  所有已登录设备都需要重新验证手机号。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setConfirmAll(false)}
                className="rounded-md p-1 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-primary/20"
              >
                <XIcon className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmAll(false)}
                disabled={Boolean(pendingAction)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => logout('all')}
                disabled={Boolean(pendingAction)}
              >
                {pendingAction === 'all' ? (
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                ) : null}
                {pendingAction === 'all' ? '正在退出' : '确认退出所有设备'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
