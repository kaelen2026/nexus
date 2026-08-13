import type { DatabaseClient } from '@nexus/database'
import { eq } from 'drizzle-orm'

import { authRefreshTokens, authSessions } from '../repo/schema.js'

export async function revokeSession(database: DatabaseClient, sessionId: string): Promise<void> {
  const now = new Date()
  await database.transaction(async (transaction) => {
    await transaction
      .update(authSessions)
      .set({ revokedAt: now })
      .where(eq(authSessions.id, sessionId))
    await transaction
      .update(authRefreshTokens)
      .set({ revokedAt: now })
      .where(eq(authRefreshTokens.sessionId, sessionId))
  })
}

export async function revokeAllSessions(database: DatabaseClient, userId: string): Promise<void> {
  const now = new Date()
  await database.transaction(async (transaction) => {
    const sessions = await transaction
      .update(authSessions)
      .set({ revokedAt: now })
      .where(eq(authSessions.userId, userId))
      .returning({ id: authSessions.id })
    for (const session of sessions) {
      await transaction
        .update(authRefreshTokens)
        .set({ revokedAt: now })
        .where(eq(authRefreshTokens.sessionId, session.id))
    }
  })
}
