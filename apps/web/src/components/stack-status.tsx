'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon, RefreshCwIcon } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'

const stackSchema = z.array(z.string().min(1))

const stack = ['Next.js 16', 'Tailwind CSS', 'shadcn/ui', 'TanStack Query', 'Zod']

async function loadStack() {
  return stackSchema.parse(stack)
}

export function StackStatus() {
  const query = useQuery({
    queryKey: ['web-stack'],
    queryFn: loadStack,
    staleTime: Number.POSITIVE_INFINITY,
  })

  return (
    <section aria-labelledby="stack-heading" className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="stack-heading" className="text-sm font-medium text-muted-foreground">
          技术栈状态
        </h2>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCwIcon data-icon="inline-start" />
          重新校验
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {(query.data ?? stack).map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground"
          >
            <CheckIcon className="text-muted-foreground" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
