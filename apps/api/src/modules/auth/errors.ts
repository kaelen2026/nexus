export class InvalidOtpError extends Error {
  constructor() {
    super('Invalid or expired OTP')
    this.name = 'InvalidOtpError'
  }
}
