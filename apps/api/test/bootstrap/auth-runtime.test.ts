import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createApiRuntime } from '../../src/bootstrap/runtime.js'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const inspector = createClient({ url: redisUrl })

beforeAll(async () => {
  await inspector.connect()
})

afterAll(async () => {
  await inspector.quit()
})

describe('Auth runtime composition', () => {
  it('wires the HTTP route through Redis and closes owned resources', async () => {
    const sendSms = vi.fn()
    const runtime = await createApiRuntime({
      env: {
        OTP_HASH_SECRET: 'test-secret-at-least-32-characters',
        REDIS_URL: redisUrl,
      },
      generateOtp: () => '123456',
      smsSender: { sendOtp: sendSms },
    })

    try {
      const response = await runtime.app.request('/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+8613800138000' }),
      })

      expect(response.status).toBe(202)
      expect(sendSms).toHaveBeenCalledWith({ phoneNumber: '+8613800138000', otp: '123456' })
      expect(await inspector.get('auth:otp:+8613800138000')).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      await runtime.close()
      await runtime.close()
      await inspector.del('auth:otp:+8613800138000')
    }
  })
})
