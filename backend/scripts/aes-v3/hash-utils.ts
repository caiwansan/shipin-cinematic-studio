/**
 * scripts/aes-v3/hash-utils.ts — 哈希工具
 */

import crypto from 'crypto'

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex')
}

export function normalize(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort())
}
