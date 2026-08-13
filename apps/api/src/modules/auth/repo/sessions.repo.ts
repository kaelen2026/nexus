import type { DatabaseClient } from '@nexus/database'
import { and, eq, gt, isNull } from 'drizzle-orm'

import { authSessions } from './schema.js'

export async function hasActiveSession(
  database: DatabaseClient,
  input: { sessionId: string; userId: string; accountId: string },
): Promise<boolean> {
  const [session] = await database
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, input.sessionId),
        eq(authSessions.userId, input.userId),
        eq(authSessions.accountId, input.accountId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return Boolean(session)
}
