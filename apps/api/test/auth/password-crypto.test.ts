import { describe, expect, it } from 'vitest'

import { createPasswordService } from '../../src/modules/auth/index.js'

describe('password hashing', () => {
  it('creates salted hashes and verifies without storing plaintext', async () => {
    const passwords = createPasswordService()
    const first = await passwords.hash('correct horse battery staple')
    const second = await passwords.hash('correct horse battery staple')

    expect(first).not.toContain('correct horse battery staple')
    expect(first).not.toBe(second)
    await expect(passwords.verify('correct horse battery staple', first)).resolves.toBe(true)
    await expect(passwords.verify('wrong password', first)).resolves.toBe(false)
  })
})
