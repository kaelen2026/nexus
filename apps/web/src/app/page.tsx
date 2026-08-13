import { StackStatus } from '@/components/stack-status'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-6 py-16 lg:px-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Nexus Web</h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Next.js 16 前端已接入 Tailwind CSS、shadcn/ui、TanStack Query 与 Zod。
        </p>
      </div>
      <StackStatus />
    </main>
  )
}
