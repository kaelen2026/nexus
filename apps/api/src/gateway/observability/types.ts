export interface HttpLogEntry {
  event: 'http.request.completed' | 'http.request.failed'
  requestId: string
  traceId: string
  spanId: string
  method: string
  route: string
  statusCode: number
  durationMs: number
  identitySubject?: string
}

export interface HttpSpan {
  name: string
  requestId: string
  traceId: string
  spanId: string
  method: string
  route: string
  statusCode: number
  durationMs: number
  status: 'ok' | 'error'
  identitySubject?: string
}

export interface ObservabilitySink {
  log(entry: HttpLogEntry): void
  recordSpan(span: HttpSpan): void
}

export interface HttpMetrics {
  record(input: { method: string; route: string; statusCode: number; durationMs: number }): void
  render(): string
}
