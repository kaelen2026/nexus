import type { ObservabilitySink } from './types.js'

export function createConsoleObservabilitySink(): ObservabilitySink {
  return {
    log(entry) {
      const write = entry.event === 'http.request.failed' ? console.error : console.info
      write(JSON.stringify(entry))
    },
    recordSpan(span) {
      console.debug(JSON.stringify({ event: 'http.server.span', ...span }))
    },
  }
}
