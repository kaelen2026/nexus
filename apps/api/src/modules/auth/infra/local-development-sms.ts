import type { SmsSender } from '../types.js'

interface LocalSmsMessage {
  phoneNumber: string
  otp: string
}

export function createLocalDevelopmentSms(): {
  sender: SmsSender
  getLatest(phoneNumber: string): LocalSmsMessage | undefined
} {
  const messages = new Map<string, LocalSmsMessage>()

  return {
    sender: {
      async sendOtp(message) {
        messages.set(message.phoneNumber, { ...message })
      },
    },
    getLatest(phoneNumber) {
      return messages.get(phoneNumber)
    },
  }
}
