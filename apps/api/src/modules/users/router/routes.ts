import { type Context, Hono } from 'hono'
import { z } from 'zod'

import type { GatewayEnvironment } from '../../../gateway/index.js'
import { UserNotFoundError, UserSuspendedError } from '../errors.js'
import type {
  DeleteAccount,
  GetCurrentUser,
  GetProfile,
  GetSettings,
  UpdateProfile,
  UpdateSettings,
} from '../types.js'

const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
    avatarUrl: z.url().max(2_048).nullable().optional(),
  })
  .refine((input) => input.displayName !== undefined || input.avatarUrl !== undefined)

const settingsUpdateSchema = z
  .object({
    locale: z.string().trim().min(2).max(35).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .refine((input) => input.locale !== undefined || input.timezone !== undefined)

export function createUsersRouter(options: {
  getCurrentUser: GetCurrentUser
  getProfile?: GetProfile
  updateProfile?: UpdateProfile
  getSettings?: GetSettings
  updateSettings?: UpdateSettings
  deleteAccount?: DeleteAccount
}) {
  const router = new Hono<GatewayEnvironment>()

  const userId = (context: Context<GatewayEnvironment>) => {
    const identity = context.get('requestContext').identity
    return identity?.type === 'user' ? identity.subject : undefined
  }

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

  if (options.deleteAccount) {
    router.delete('/me', async (context) => {
      const subject = userId(context)
      if (!subject)
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      await options.deleteAccount?.({ userId: subject })
      return context.body(null, 204)
    })
  }

  if (options.getProfile) {
    router.get('/me/profile', async (context) => {
      const subject = userId(context)
      if (!subject)
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      return context.json(await options.getProfile?.(subject))
    })
  }

  if (options.updateProfile) {
    router.patch('/me/profile', async (context) => {
      const subject = userId(context)
      if (!subject)
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      const body = profileUpdateSchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success)
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      return context.json(
        await options.updateProfile?.({
          userId: subject,
          ...(body.data.displayName !== undefined ? { displayName: body.data.displayName } : {}),
          ...(body.data.avatarUrl !== undefined ? { avatarUrl: body.data.avatarUrl } : {}),
        }),
      )
    })
  }

  if (options.getSettings) {
    router.get('/me/settings', async (context) => {
      const subject = userId(context)
      if (!subject)
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      return context.json(await options.getSettings?.(subject))
    })
  }

  if (options.updateSettings) {
    router.patch('/me/settings', async (context) => {
      const subject = userId(context)
      if (!subject)
        return context.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
          401,
        )
      const body = settingsUpdateSchema.safeParse(await context.req.json().catch(() => null))
      if (!body.success)
        return context.json(
          { error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } },
          400,
        )
      return context.json(
        await options.updateSettings?.({
          userId: subject,
          ...(body.data.locale !== undefined ? { locale: body.data.locale } : {}),
          ...(body.data.timezone !== undefined ? { timezone: body.data.timezone } : {}),
        }),
      )
    })
  }

  return router
}
