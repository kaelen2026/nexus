import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuthApi } from '@/lib/auth-api'
import { PhoneOtpLogin } from './phone-otp-login'

function createAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    sendOtp: vi.fn().mockResolvedValue({ expiresAt: '2026-08-13T08:01:00.000Z' }),
    verifyOtp: vi.fn().mockResolvedValue({
      sessionMode: 'cookie',
      accessTokenExpiresAt: '2026-08-13T08:15:00.000Z',
    }),
    sendEmailOtp: vi.fn().mockResolvedValue({ expiresAt: '2026-08-13T08:01:00.000Z' }),
    verifyEmailOtp: vi.fn().mockResolvedValue({
      sessionMode: 'cookie',
      accessTokenExpiresAt: '2026-08-13T08:15:00.000Z',
    }),
    ...overrides,
  }
}

describe('PhoneOtpLogin', () => {
  afterEach(() => vi.useRealTimers())

  it('offers Google and Apple authentication', () => {
    render(<PhoneOtpLogin api={createAuthApi()} oauthBaseUrl="https://api.nexus.test" />)

    expect(screen.getByRole('link', { name: '使用 Google 登录' })).toHaveAttribute(
      'href',
      'https://api.nexus.test/auth/oauth/google',
    )
    expect(screen.getByRole('link', { name: '使用 Apple 登录' })).toHaveAttribute(
      'href',
      'https://api.nexus.test/auth/oauth/apple',
    )
  })

  it('rejects an invalid phone number without sending a request', async () => {
    const api = createAuthApi()
    render(<PhoneOtpLogin api={api} />)

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请输入有效的手机号')
    expect(api.sendOtp).not.toHaveBeenCalled()
  })

  it('sends an OTP and advances to the verification step', async () => {
    const api = createAuthApi()
    render(<PhoneOtpLogin api={api} />)

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '+86 138 0000 0000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(await screen.findByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
    expect(api.sendOtp).toHaveBeenCalledWith({ phoneNumber: '+86 138 0000 0000' })
    expect(screen.getByText('验证码已发送至 +86 138 **** 0000')).toBeInTheDocument()
  })

  it('supports email OTP authentication', async () => {
    const api = createAuthApi()
    const onAuthenticated = vi.fn()
    render(<PhoneOtpLogin api={api} onAuthenticated={onAuthenticated} />)

    fireEvent.click(screen.getByRole('button', { name: '邮箱' }))
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'Alice@Example.COM' } })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(await screen.findByText('验证码已发送至 Alice@Example.COM')).toBeInTheDocument()
    expect(api.sendEmailOtp).toHaveBeenCalledWith({ email: 'Alice@Example.COM' })

    fireEvent.change(screen.getByLabelText('6 位验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
    expect(api.verifyEmailOtp).toHaveBeenCalledWith({
      email: 'Alice@Example.COM',
      otp: '123456',
      sessionMode: 'cookie',
    })
  })

  it('rejects an incomplete verification code without sending a request', async () => {
    const api = createAuthApi()
    render(<PhoneOtpLogin api={api} />)

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '+86 138 0000 0000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    await screen.findByRole('heading', { name: '输入验证码' })

    fireEvent.change(screen.getByLabelText('6 位验证码'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请输入 6 位验证码')
    expect(api.verifyOtp).not.toHaveBeenCalled()
  })

  it('shows an invalid OTP response and keeps the verification step', async () => {
    const api = createAuthApi({
      verifyOtp: vi.fn().mockRejectedValue(new Error('验证码无效或已过期')),
    })
    render(<PhoneOtpLogin api={api} />)

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '+86 138 0000 0000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    await screen.findByRole('heading', { name: '输入验证码' })
    fireEvent.change(screen.getByLabelText('6 位验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('验证码无效或已过期')
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeInTheDocument()
  })

  it('verifies with cookie mode and reports authentication success', async () => {
    const api = createAuthApi()
    const onAuthenticated = vi.fn()
    render(<PhoneOtpLogin api={api} onAuthenticated={onAuthenticated} />)

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '+86 138 0000 0000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    await screen.findByRole('heading', { name: '输入验证码' })
    fireEvent.change(screen.getByLabelText('6 位验证码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
    expect(api.verifyOtp).toHaveBeenCalledWith({
      phoneNumber: '+86 138 0000 0000',
      otp: '123456',
      sessionMode: 'cookie',
    })
  })

  it('prevents resending until the OTP expires, then sends a new OTP', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T08:00:00.000Z'))
    const sendOtp = vi.fn().mockResolvedValue({ expiresAt: '2026-08-13T08:01:00.000Z' })
    const api = createAuthApi({ sendOtp })
    render(<PhoneOtpLogin api={api} />)

    fireEvent.change(screen.getByLabelText('手机号'), {
      target: { value: '+86 138 0000 0000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    await act(async () => undefined)

    expect(screen.getByRole('button', { name: '重新发送（60s）' })).toBeDisabled()
    expect(sendOtp).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTime(60_000))
    fireEvent.click(screen.getByRole('button', { name: '重新发送' }))
    await act(async () => undefined)

    expect(sendOtp).toHaveBeenCalledTimes(2)
  })
})
