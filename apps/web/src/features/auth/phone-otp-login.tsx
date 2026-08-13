'use client'

import { ArrowLeftIcon, LoaderCircleIcon } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { z } from 'zod'

import { NexusMark } from '@/components/nexus-brand'
import { Button } from '@/components/ui/button'
import { type AuthApi, authApi } from '@/lib/auth-api'

const phoneSchema = z.string().trim().min(8).max(32)
const emailSchema = z.email().max(320)
const otpSchema = z.string().regex(/^\d{6}$/)
const otpSlots = ['one', 'two', 'three', 'four', 'five', 'six'] as const

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
  const [step, setStep] = useState<'credential' | 'otp'>('credential')
  const [method, setMethod] = useState<'phone' | 'email'>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>()
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (!otpExpiresAt) return

    function updateRemainingTime() {
      setResendSeconds(Math.max(0, Math.ceil(((otpExpiresAt ?? 0) - Date.now()) / 1000)))
    }

    updateRemainingTime()
    const timer = window.setInterval(updateRemainingTime, 1000)
    return () => window.clearInterval(timer)
  }, [otpExpiresAt])

  async function requestOtp(credential: string) {
    setError(undefined)
    setIsSubmitting(true)
    try {
      const result =
        method === 'phone'
          ? await api.sendOtp({ phoneNumber: credential })
          : await api.sendEmailOtp({ email: credential })
      if (method === 'phone') setPhoneNumber(credential)
      else setEmail(credential)
      setOtpExpiresAt(new Date(result.expiresAt).getTime())
      setStep('otp')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = (method === 'phone' ? phoneSchema : emailSchema).safeParse(
      method === 'phone' ? phoneNumber : email,
    )
    if (!parsed.success) {
      setError(method === 'phone' ? '请输入有效的手机号' : '请输入有效的邮箱地址')
      return
    }

    await requestOtp(parsed.data)
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
      if (method === 'phone') {
        await api.verifyOtp({ phoneNumber, otp: parsed.data, sessionMode: 'cookie' })
      } else {
        await api.verifyEmailOtp({ email, otp: parsed.data, sessionMode: 'cookie' })
      }
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
          className={`h-px bg-primary transition-[width] duration-300 ${step === 'credential' ? 'w-16' : 'w-40'}`}
        />
      </div>

      {step === 'credential' ? (
        <form onSubmit={sendOtp} noValidate>
          <header className="mb-12">
            <h1 className="text-[2rem] font-semibold tracking-[-0.045em]">登录 Nexus</h1>
            <p className="mt-3 text-base text-muted-foreground">使用手机号或邮箱继续</p>
          </header>

          <fieldset
            className="mb-8 grid grid-cols-2 rounded-[0.7rem] bg-muted p-1"
            aria-label="登录方式"
          >
            {(['phone', 'email'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMethod(option)
                  setError(undefined)
                }}
                className={`h-10 rounded-[0.55rem] text-sm font-medium transition-colors ${
                  method === option ? 'bg-background shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {option === 'phone' ? '手机号' : '邮箱'}
              </button>
            ))}
          </fieldset>

          <label className="block text-sm font-medium" htmlFor="credential">
            {method === 'phone' ? '手机号' : '邮箱'}
          </label>
          <input
            id="credential"
            type={method === 'email' ? 'email' : 'tel'}
            autoComplete={method === 'phone' ? 'tel' : 'email'}
            inputMode={method === 'phone' ? 'tel' : 'email'}
            value={method === 'phone' ? phoneNumber : email}
            onChange={(event) => {
              if (method === 'phone') setPhoneNumber(event.target.value)
              else setEmail(event.target.value)
              setError(undefined)
            }}
            placeholder={method === 'phone' ? '+86 138 0000 0000' : 'you@example.com'}
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
              验证码已发送至 {method === 'phone' ? maskPhoneNumber(phoneNumber) : email}
            </p>
          </header>

          <label className="block text-sm font-medium" htmlFor="otp">
            6 位验证码
          </label>
          <div className="relative mt-3 grid grid-cols-6 gap-2">
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
              className="peer absolute inset-0 z-10 cursor-text opacity-0"
            />
            {otpSlots.map((slot, index) => (
              <span
                key={slot}
                aria-hidden="true"
                className={`flex h-14 items-center justify-center rounded-[0.7rem] border bg-background font-mono text-xl transition-shadow ${
                  error ? 'border-destructive' : ''
                } ${index === otp.length ? 'peer-focus:border-primary peer-focus:ring-3 peer-focus:ring-primary/15' : ''}`}
              >
                {otp[index] ?? ''}
              </span>
            ))}
          </div>

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
              setStep('credential')
              setOtp('')
              setError(undefined)
            }}
            className="mx-auto mt-6 flex items-center gap-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            更换{method === 'phone' ? '手机号' : '邮箱'}
          </button>
          <button
            type="button"
            disabled={isSubmitting || resendSeconds > 0}
            onClick={() => requestOtp(method === 'phone' ? phoneNumber : email)}
            className="mx-auto mt-10 block text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary/20 disabled:text-muted-foreground disabled:no-underline"
          >
            {resendSeconds > 0 ? `重新发送（${resendSeconds}s）` : '重新发送'}
          </button>
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
