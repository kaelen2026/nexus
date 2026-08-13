import type { EmailSender } from '../types.js'

export function createLocalDevelopmentEmail() {
  const messages = new Map<string, { email: string; otp: string }>()
  const sender: EmailSender = {
    async sendOtp(message) {
      messages.set(message.email, message)
    },
  }
  return { sender, getLatest: (email: string) => messages.get(email.trim().toLowerCase()) }
}
