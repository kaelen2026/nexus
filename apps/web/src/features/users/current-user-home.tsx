'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, LoaderCircleIcon, ShieldCheckIcon, UserRoundIcon } from 'lucide-react'
import { useEffect } from 'react'

import { NexusMark } from '@/components/nexus-brand'
import { Button } from '@/components/ui/button'
import { SessionActions } from '@/features/auth/session-actions'
import { GenerateWorkspace } from '@/features/llm/generate-workspace'
import { ApiError, apiClient, type NexusApi } from '@/lib/api-client'

const defaultNavigate = (path: string) => window.location.assign(path)

interface CurrentUserHomeProps {
  api?: NexusApi
  navigate?: (path: string) => void
}

export function CurrentUserHome({
  api = apiClient,
  navigate = defaultNavigate,
}: CurrentUserHomeProps) {
  const userQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.getCurrentUser(),
    retry: false,
    staleTime: 60_000,
  })
  const isUnauthenticated =
    userQuery.error instanceof ApiError && userQuery.error.code === 'UNAUTHENTICATED'

  useEffect(() => {
    if (isUnauthenticated) navigate('/login')
  }, [isUnauthenticated, navigate])

  if (userQuery.isPending || isUnauthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircleIcon className="size-5 animate-spin text-primary" aria-hidden="true" />
          正在读取账户
        </div>
      </main>
    )
  }

  if (userQuery.error) {
    const isSuspended =
      userQuery.error instanceof ApiError && userQuery.error.code === 'USER_SUSPENDED'
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-md text-center">
          <AlertTriangleIcon className="mx-auto size-10 text-destructive" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {isSuspended ? '账户已暂停' : '暂时无法读取账户'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isSuspended ? '此账户暂时无法使用 Nexus。' : userQuery.error.message}
          </p>
          {!isSuspended && (
            <Button className="mt-8" onClick={() => userQuery.refetch()}>
              重试
            </Button>
          )}
        </section>
      </main>
    )
  }

  const user = userQuery.data
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f9ff]">
      <header className="border-b bg-background/95 px-6 backdrop-blur sm:px-10">
        <div className="mx-auto flex h-[5.75rem] max-w-[91rem] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <NexusMark />
            <span className="text-xl font-semibold tracking-[-0.03em]">Nexus</span>
          </div>
          <div className="hidden h-full items-center sm:flex">
            <span className="flex h-full items-center border-b-[3px] border-primary px-5 text-sm font-semibold text-primary">
              生成
            </span>
          </div>
          <SessionActions api={api} navigate={navigate} />
        </div>
      </header>
      <GenerateWorkspace api={api} navigate={navigate} />
      <section aria-label="账户信息" className="mt-auto border-t bg-background px-6 sm:px-10">
        <dl className="mx-auto flex min-h-24 max-w-[91rem] flex-col gap-5 py-5 sm:flex-row sm:items-center sm:gap-10 sm:py-0">
          <AccountField icon={ShieldCheckIcon} label="账户状态" value="正常" />
          <div className="hidden h-10 w-px bg-border sm:block" aria-hidden="true" />
          <AccountField icon={UserRoundIcon} label="用户 ID" value={user.id} mono />
        </dl>
      </section>
    </main>
  )
}

function AccountField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof ShieldCheckIcon
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-sm font-medium ${mono ? 'font-mono' : 'text-emerald-600'}`}>{value}</dd>
    </div>
  )
}
