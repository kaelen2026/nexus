import type { DatabaseClient, DatabaseTransaction } from '@nexus/database'
import { and, eq, isNull } from 'drizzle-orm'

import { usersUserCreatedOutbox } from './schema.js'

export async function enqueueUserCreated(
  transaction: DatabaseTransaction,
  userId: string,
): Promise<void> {
  await transaction.insert(usersUserCreatedOutbox).values({ userId })
}

export function findPendingUserCreatedEvents(database: DatabaseClient, userId?: string) {
  return database
    .select({
      eventId: usersUserCreatedOutbox.eventId,
      userId: usersUserCreatedOutbox.userId,
      occurredAt: usersUserCreatedOutbox.occurredAt,
    })
    .from(usersUserCreatedOutbox)
    .where(
      userId
        ? and(isNull(usersUserCreatedOutbox.publishedAt), eq(usersUserCreatedOutbox.userId, userId))
        : isNull(usersUserCreatedOutbox.publishedAt),
    )
    .orderBy(usersUserCreatedOutbox.occurredAt)
}

export async function markUserCreatedPublished(
  database: DatabaseClient,
  eventId: string,
): Promise<void> {
  await database
    .update(usersUserCreatedOutbox)
    .set({ publishedAt: new Date() })
    .where(
      and(eq(usersUserCreatedOutbox.eventId, eventId), isNull(usersUserCreatedOutbox.publishedAt)),
    )
}
