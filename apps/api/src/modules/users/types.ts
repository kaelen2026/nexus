export type UserStatus = 'active' | 'suspended' | 'deleted'

export interface UserSummary {
  id: string
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export type GetCurrentUser = (userId: string) => Promise<UserSummary>
export type DeleteAccount = (input: { userId: string }) => Promise<void>

export interface UserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserSettings {
  userId: string
  locale: string
  timezone: string
  createdAt: Date
  updatedAt: Date
}

export type UpdateProfileInput = {
  userId: string
  displayName?: string | null
  avatarUrl?: string | null
}
export type UpdateSettingsInput = { userId: string; locale?: string; timezone?: string }
export type GetProfile = (userId: string) => Promise<UserProfile>
export type UpdateProfile = (input: UpdateProfileInput) => Promise<UserProfile>
export type GetSettings = (userId: string) => Promise<UserSettings>
export type UpdateSettings = (input: UpdateSettingsInput) => Promise<UserSettings>
