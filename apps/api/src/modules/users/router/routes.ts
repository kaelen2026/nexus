import { Hono } from 'hono'

import type { GatewayEnvironment } from '../../../gateway/index.js'
import { UserNotFoundError, UserSuspendedError } from '../errors.js'
import type { GetCurrentUser } from '../types.js'

export function createUsersRouter(options: { getCurrentUser: GetCurrentUser }) {
  const router = new Hono<GatewayEnvironment>()

  router.get('/me', async (context) => {
    const identity = context.get('requestContext').identity
    if (identity?.type !== 'user') {
      return context.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        401,
      )
    }

    try {
      return context.json(await options.getCurrentUser(identity.subject))
    } catch (error) {
      if (error instanceof UserSuspendedError) {
        return context.json(
          { error: { code: 'USER_SUSPENDED', message: 'User is suspended' } },
          403,
        )
      }
      if (error instanceof UserNotFoundError) {
        return context.json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404)
      }
      throw error
    }
  })

  return router
}
