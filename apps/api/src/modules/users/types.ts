export type UserStatus = 'active' | 'suspended' | 'deleted'

export interface UserSummary {
  id: string
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export type GetCurrentUser = (userId: string) => Promise<UserSummary>

export type DeleteAccount = (input: { userId: string }) => Promise<void>
