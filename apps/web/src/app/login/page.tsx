import type { Metadata } from 'next'

import { NexusMark } from '@/components/nexus-brand'
import { PhoneOtpLogin } from '@/features/auth/phone-otp-login'

export const metadata: Metadata = {
  title: '登录 | Nexus',
  description: '登录 Nexus',
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(20rem,0.52fr)_minmax(32rem,1fr)]">
      <aside className="relative hidden overflow-hidden border-r bg-[#f7f9ff] lg:flex lg:flex-col lg:justify-end lg:p-16 xl:p-20">
        <div className="auth-contours absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-4">
            <NexusMark />
            <span className="text-4xl font-semibold tracking-[-0.05em]">Nexus</span>
          </div>
          <p className="mt-7 text-lg text-muted-foreground">新一代 AI，与你同频进化</p>
        </div>
      </aside>
      <section className="flex min-h-screen items-center justify-center px-6 py-16 sm:px-10 lg:px-16">
        <PhoneOtpLogin />
      </section>
    </main>
  )
}
