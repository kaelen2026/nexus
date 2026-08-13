export interface RuntimeIdentity {
  type: 'user' | 'api_key' | 'service'
  subject: string
  accountId?: string
  sessionId?: string
  roles: string[]
  scopes: string[]
}

export interface RequestContext {
  requestId: string
  traceId: string
  spanId: string
  identity: RuntimeIdentity | null
  client: {
    ip?: string
    userAgent?: string
  }
  startedAt: number
}

export interface GatewayEnvironment {
  Variables: {
    requestContext: RequestContext
  }
}
