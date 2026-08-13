'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, LoaderCircleIcon, SparklesIcon } from 'lucide-react'
import { useEffect } from 'react'

import { NexusMark } from '@/components/nexus-brand'
import { Button } from '@/components/ui/button'
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
    <main className="min-h-screen bg-[#f7f9ff]">
      <header className="border-b bg-background/90 px-6 py-5 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <NexusMark />
          <span className="text-xl font-semibold tracking-[-0.03em]">Nexus</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-20">
        <section className="max-w-2xl">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SparklesIcon className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-7 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">欢迎回来</h1>
          <p className="mt-4 text-lg text-muted-foreground">你的 Nexus 账户已准备就绪。</p>
        </section>

        <section aria-labelledby="account-heading" className="mt-14 max-w-3xl border-t pt-8">
          <h2 id="account-heading" className="text-sm font-medium text-muted-foreground">
            账户信息
          </h2>
          <dl className="mt-6 grid gap-x-12 gap-y-7 sm:grid-cols-2">
            <UserField label="用户 ID" value={user.id} mono />
            <UserField label="状态" value={user.status === 'active' ? '正常' : user.status} />
            <UserField label="创建时间" value={formatUtcDate(user.createdAt)} />
            <UserField label="更新时间" value={formatUtcDate(user.updatedAt)} />
          </dl>
        </section>
      </div>
    </main>
  )
}

function UserField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-2 text-base font-medium ${mono ? 'font-mono text-sm' : ''}`}>{value}</dd>
    </div>
  )
}

function formatUtcDate(value: string): string {
  const date = new Date(value)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`
}
