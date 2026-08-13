import type { DatabaseTransaction } from '@nexus/database'

import { insertUser } from '../repo/users.repo.js'

export function createUser(transaction: DatabaseTransaction): Promise<{ userId: string }> {
  return insertUser(transaction).then((user) => ({ userId: user.id }))
}
