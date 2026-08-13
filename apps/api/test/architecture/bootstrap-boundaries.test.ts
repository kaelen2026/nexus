import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('bootstrap boundaries', () => {
  it('does not import infrastructure SDKs directly', async () => {
    const runtimePath = fileURLToPath(new URL('../../src/bootstrap/runtime.ts', import.meta.url))
    const source = await readFile(runtimePath, 'utf8')

    expect(source).not.toMatch(/from ['"]redis['"]/)
  })
})
