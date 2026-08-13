export async function completeEmailAuthentication(
  dependencies: {
    consumeOtp(input: { email: string; otp: string }): Promise<void>
    createIdentity(input: { email: string; sessionExpiresAt: Date }): Promise<{
      userId: string
      accountId: string
      sessionId: string
    }>
  },
  input: { email: string; otp: string; sessionExpiresAt: Date },
) {
  await dependencies.consumeOtp({ email: input.email, otp: input.otp })
  return dependencies.createIdentity({
    email: input.email,
    sessionExpiresAt: input.sessionExpiresAt,
  })
}
