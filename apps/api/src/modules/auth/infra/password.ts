import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const keyLength = 64
const cost = 16_384
const blockSize = 8
const parallelization = 1

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })
}

export function createPasswordService() {
  return {
    async hash(password: string): Promise<string> {
      const salt = randomBytes(16)
      const key = await derive(password, salt)
      return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString('base64url')}$${key.toString('base64url')}`
    },
    async verify(password: string, encoded: string): Promise<boolean> {
      const [algorithm, encodedCost, encodedBlockSize, encodedParallelization, salt, hash] =
        encoded.split('$')
      if (
        algorithm !== 'scrypt' ||
        Number(encodedCost) !== cost ||
        Number(encodedBlockSize) !== blockSize ||
        Number(encodedParallelization) !== parallelization ||
        !salt ||
        !hash
      ) {
        return false
      }
      const expected = Buffer.from(hash, 'base64url')
      if (expected.length !== keyLength) return false
      const actual = await derive(password, Buffer.from(salt, 'base64url'))
      return timingSafeEqual(actual, expected)
    },
  }
}
