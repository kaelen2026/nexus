import { cors } from 'hono/cors'

export function createCorsMiddleware(options: { trustedOrigins: string[] }) {
  const trustedOrigins = new Set(options.trustedOrigins)
  return cors({
    origin: (origin) => (trustedOrigins.has(origin) ? origin : ''),
    credentials: true,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
}
