export class UserNotFoundError extends Error {
  constructor() {
    super('User not found')
    this.name = 'UserNotFoundError'
  }
}

export class UserSuspendedError extends Error {
  constructor() {
    super('User is suspended')
    this.name = 'UserSuspendedError'
  }
}
