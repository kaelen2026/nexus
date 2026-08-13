import type { DatabaseClient } from '@nexus/database'
import { and, eq, gt, isNull } from 'drizzle-orm'

import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../errors.js'
import { createRefreshTokenService } from '../infra/token.js'
import { authRefreshTokens, authSessions } from '../repo/schema.js'

interface RefreshTokenInput {
  secret: string
  expiresAt: Date
}

export async function createRefreshSession(
  database: DatabaseClient,
  input: RefreshTokenInput & { sessionId: string },
) {
  const tokens = createRefreshTokenService(input.secret)
  const refreshToken = tokens.generate()
  await database.insert(authRefreshTokens).values({
    sessionId: input.sessionId,
    tokenHash: tokens.hash(refreshToken),
    expiresAt: input.expiresAt,
  })
  return { refreshToken }
}

export async function rotateRefreshToken(
  database: DatabaseClient,
  input: RefreshTokenInput & { refreshToken: string },
) {
  const tokens = createRefreshTokenService(input.secret)
  const tokenHash = tokens.hash(input.refreshToken)
  const nextRefreshToken = tokens.generate()
  const nextHash = tokens.hash(nextRefreshToken)
  const now = new Date()

  const result = await database.transaction(async (transaction) => {
    const [rotated] = await transaction
      .update(authRefreshTokens)
      .set({ rotatedAt: now })
      .where(
        and(
          eq(authRefreshTokens.tokenHash, tokenHash),
          isNull(authRefreshTokens.rotatedAt),
          isNull(authRefreshTokens.revokedAt),
          gt(authRefreshTokens.expiresAt, now),
        ),
      )
      .returning({ sessionId: authRefreshTokens.sessionId })

    if (rotated) {
      const [session] = await transaction
        .select({ revokedAt: authSessions.revokedAt, expiresAt: authSessions.expiresAt })
        .from(authSessions)
        .where(eq(authSessions.id, rotated.sessionId))
        .limit(1)
      if (!session || session.revokedAt || session.expiresAt <= now)
        return { status: 'invalid' as const }

      await transaction.insert(authRefreshTokens).values({
        sessionId: rotated.sessionId,
        tokenHash: nextHash,
        expiresAt: input.expiresAt,
      })
      return { status: 'rotated' as const }
    }

    const [existing] = await transaction
      .select({ sessionId: authRefreshTokens.sessionId, rotatedAt: authRefreshTokens.rotatedAt })
      .from(authRefreshTokens)
      .where(eq(authRefreshTokens.tokenHash, tokenHash))
      .limit(1)
    if (!existing?.rotatedAt) return { status: 'invalid' as const }

    await transaction
      .update(authSessions)
      .set({ revokedAt: now })
      .where(eq(authSessions.id, existing.sessionId))
    await transaction
      .update(authRefreshTokens)
      .set({ revokedAt: now })
      .where(eq(authRefreshTokens.sessionId, existing.sessionId))
    return { status: 'reuse' as const }
  })

  if (result.status === 'reuse') throw new RefreshTokenReuseError()
  if (result.status === 'invalid') throw new InvalidRefreshTokenError()
  return { refreshToken: nextRefreshToken }
}
