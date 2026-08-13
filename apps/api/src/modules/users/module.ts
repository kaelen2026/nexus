import type { DatabaseClient } from '@nexus/database'

import type { EventBus } from '../../shared/events/index.js'
import { getCurrentUser } from './service/get-current-user.js'
import { getProfile, updateProfile } from './service/profile.js'
import { createUserCreatedPublisher } from './service/publish-user-created.js'
import { getSettings, updateSettings } from './service/settings.js'

export function createUsersModule(options: { database: DatabaseClient; eventBus: EventBus }) {
  const publishPendingEvents = createUserCreatedPublisher(options)
  return {
    getCurrentUser: (userId: string) => getCurrentUser(options.database, userId),
    getProfile: (userId: string) => getProfile(options.database, userId),
    updateProfile: (input: Parameters<typeof updateProfile>[1]) =>
      updateProfile(options.database, input),
    getSettings: (userId: string) => getSettings(options.database, userId),
    updateSettings: (input: Parameters<typeof updateSettings>[1]) =>
      updateSettings(options.database, input),
    publishUserCreated: (userId: string) => publishPendingEvents(userId),
    replayPendingEvents: () => publishPendingEvents(),
  }
}
