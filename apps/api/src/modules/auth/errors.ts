export class InvalidOtpError extends Error {
  constructor() {
    super('Invalid or expired OTP')
    this.name = 'InvalidOtpError'
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid refresh token')
    this.name = 'InvalidRefreshTokenError'
  }
}

export class RefreshTokenReuseError extends Error {
  constructor() {
    super('Refresh token reuse detected')
    this.name = 'RefreshTokenReuseError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password')
    this.name = 'InvalidCredentialsError'
  }
}
