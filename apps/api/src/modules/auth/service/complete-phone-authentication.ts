interface PhoneAuthenticationInput {
  phoneNumber: string
  otp: string
  sessionExpiresAt: Date
}

interface PhoneIdentity {
  userId: string
  accountId: string
  sessionId: string
}

interface PhoneAuthenticationDependencies {
  consumeOtp(input: { phoneNumber: string; otp: string }): Promise<void>
  createIdentity(input: { phoneNumber: string; sessionExpiresAt: Date }): Promise<PhoneIdentity>
}

export async function completePhoneAuthentication(
  dependencies: PhoneAuthenticationDependencies,
  input: PhoneAuthenticationInput,
): Promise<PhoneIdentity> {
  await dependencies.consumeOtp({ phoneNumber: input.phoneNumber, otp: input.otp })

  return dependencies.createIdentity({
    phoneNumber: input.phoneNumber,
    sessionExpiresAt: input.sessionExpiresAt,
  })
}
