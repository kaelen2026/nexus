'use client'

import { ArrowLeftIcon, LoaderCircleIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { type AuthApi, authApi } from '@/lib/auth-api'

const phoneSchema = z.string().trim().min(8).max(32)
const otpSchema = z.string().regex(/^\d{6}$/)

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '')
  if (digits.length < 7) return phoneNumber
  const nationalNumber = digits.slice(-11)
  const countryCode = digits.slice(0, -11)
  return `${countryCode ? `+${countryCode} ` : ''}${nationalNumber.slice(0, 3)} **** ${nationalNumber.slice(-4)}`
}

interface PhoneOtpLoginProps {
  api?: AuthApi
  onAuthenticated?: () => void
}

export function PhoneOtpLogin({
  api = authApi,
  onAuthenticated = () => window.location.assign('/'),
}: PhoneOtpLoginProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = phoneSchema.safeParse(phoneNumber)
    if (!parsed.success) {
      setError('请输入有效的手机号')
      return
    }

    setError(undefined)
    setIsSubmitting(true)
    try {
      await api.sendOtp({ phoneNumber: parsed.data })
      setPhoneNumber(parsed.data)
      setStep('otp')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = otpSchema.safeParse(otp)
    if (!parsed.success) {
      setError('请输入 6 位验证码')
      return
    }

    setError(undefined)
    setIsSubmitting(true)
    try {
      await api.verifyOtp({ phoneNumber, otp: parsed.data, sessionMode: 'cookie' })
      onAuthenticated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[25rem]">
      <div className="mb-12 flex items-center gap-3 lg:hidden">
        <NexusMark />
        <span className="text-xl font-semibold tracking-[-0.03em]">Nexus</span>
      </div>

      <div className="mb-12 h-px w-full bg-border" aria-hidden="true">
        <div
          className={`h-px bg-primary transition-[width] duration-300 ${step === 'phone' ? 'w-16' : 'w-40'}`}
        />
      </div>

      {step === 'phone' ? (
        <form onSubmit={sendOtp} noValidate>
          <header className="mb-12">
            <h1 className="text-[2rem] font-semibold tracking-[-0.045em]">登录 Nexus</h1>
            <p className="mt-3 text-base text-muted-foreground">使用手机号继续</p>
          </header>

          <label className="block text-sm font-medium" htmlFor="phone-number">
            手机号
          </label>
          <input
            id="phone-number"
            autoComplete="tel"
            inputMode="tel"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value)
              setError(undefined)
            }}
            placeholder="+86 138 0000 0000"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-error' : undefined}
            className="mt-3 h-14 w-full rounded-[0.7rem] border bg-background px-4 text-base outline-none transition-shadow placeholder:text-muted-foreground/65 focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-destructive"
          />

          <Button
            type="submit"
            className="mt-8 h-14 w-full rounded-[0.7rem] text-base"
            disabled={isSubmitting}
          >
            {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? '正在发送' : '获取验证码'}
          </Button>
          <AuthError message={error} />
        </form>
      ) : (
        <form onSubmit={verifyOtp} noValidate>
          <header className="mb-12">
            <h1 className="text-[2rem] font-semibold tracking-[-0.045em]">输入验证码</h1>
            <p className="mt-3 text-base text-muted-foreground">
              验证码已发送至 {maskPhoneNumber(phoneNumber)}
            </p>
          </header>

          <label className="block text-sm font-medium" htmlFor="otp">
            6 位验证码
          </label>
          <input
            id="otp"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
              setError(undefined)
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'auth-error' : undefined}
            className="mt-3 h-16 w-full rounded-[0.7rem] border bg-background px-5 font-mono text-2xl tracking-[1.15em] outline-none transition-shadow focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-destructive"
          />

          <Button
            type="submit"
            className="mt-8 h-14 w-full rounded-[0.7rem] text-base"
            disabled={isSubmitting}
          >
            {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? '正在验证' : '继续'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setOtp('')
              setError(undefined)
            }}
            className="mx-auto mt-6 flex items-center gap-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            更换手机号
          </button>
          <p className="mt-10 text-center text-sm text-muted-foreground">重新发送（60s）</p>
          <AuthError message={error} />
        </form>
      )}
    </div>
  )
}

function AuthError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      id="auth-error"
      role="alert"
      className="mt-6 rounded-[0.7rem] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </p>
  )
}

export function NexusMark() {
  return (
    <svg className="size-9 text-primary" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M5 26V9l13 9 13-9v17L18 17 5 26Z" fill="currentColor" />
      <path d="M5 9 18 2l13 7-6 4-7-4-7 4-6-4Z" fill="currentColor" opacity=".72" />
    </svg>
  )
}
