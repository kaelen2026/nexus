import type { HttpMetrics } from './types.js'

const durationBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

interface Series {
  count: number
  sum: number
  buckets: number[]
}

export function createInMemoryHttpMetrics(): HttpMetrics {
  const series = new Map<string, Series>()

  return {
    record(input) {
      const key = JSON.stringify([input.method, input.route, input.statusCode])
      const current = series.get(key) ?? {
        count: 0,
        sum: 0,
        buckets: durationBuckets.map(() => 0),
      }
      current.count += 1
      current.sum += input.durationMs / 1000
      for (const [index, bucket] of durationBuckets.entries()) {
        if (input.durationMs <= bucket) current.buckets[index] = (current.buckets[index] ?? 0) + 1
      }
      series.set(key, current)
    },
    render() {
      const lines = [
        '# HELP nexus_http_requests_total Total HTTP requests.',
        '# TYPE nexus_http_requests_total counter',
        '# HELP nexus_http_request_duration_seconds HTTP request duration.',
        '# TYPE nexus_http_request_duration_seconds histogram',
      ]
      for (const [key, value] of [...series.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        const [method, route, status] = JSON.parse(key) as [string, string, number]
        const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"`
        lines.push(`nexus_http_requests_total{${labels}} ${value.count}`)
        for (const [index, bucket] of durationBuckets.entries()) {
          lines.push(
            `nexus_http_request_duration_seconds_bucket{${labels},le="${bucket / 1000}"} ${value.buckets[index]}`,
          )
        }
        lines.push(`nexus_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${value.count}`)
        lines.push(`nexus_http_request_duration_seconds_sum{${labels}} ${value.sum}`)
        lines.push(`nexus_http_request_duration_seconds_count{${labels}} ${value.count}`)
      }
      return `${lines.join('\n')}\n`
    },
  }
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')
}
