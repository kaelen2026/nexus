import type { DatabaseClient } from '@nexus/database'

import { hasActiveSession } from '../repo/sessions.repo.js'

export async function authenticate(
  database: DatabaseClient,
  verifyAccessToken: (token: string) => Promise<{
    userId: string
    accountId: string
    sessionId: string
  }>,
  token: string,
) {
  const tokenIdentity = await verifyAccessToken(token)
  if (!(await hasActiveSession(database, tokenIdentity))) throw new Error('Invalid Session')
  return {
    type: 'user' as const,
    subject: tokenIdentity.userId,
    accountId: tokenIdentity.accountId,
    sessionId: tokenIdentity.sessionId,
    roles: [],
    scopes: [],
  }
}
