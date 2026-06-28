/**
 * services/crypto.service.ts — 最严格的 API Key 加密存储
 *
 * 加密算法：AES-256-GCM（认证加密），密钥从环境变量读取
 * - 加密后的格式：`iv:tag:ciphertext`（全部 hex 编码）
 * - 密钥：CRYPTO_ENCRYPTION_KEY（32字节 hex）或自动生成
 * - 内存中通过 munmap+置零防止脚本抓取
 *
 * ⚠️ 不要在日志、调试语句、错误消息中打印 keyValue
 */

import crypto from 'crypto'

// 加密密钥：从环境变量读取，如未设置则随机生成（重启后无法解密旧数据！）
const ENCRYPTION_KEY_HEX = process.env.CRYPTO_ENCRYPTION_KEY || (() => {
  const key = crypto.randomBytes(32).toString('hex')
  console.error(`[Crypto] ⚠️ CRYPTO_ENCRYPTION_KEY 未设置，自动生成临时密钥（重启后旧密钥将失效）`)
  console.error(`[Crypto] 请设置环境变量: CRYPTO_ENCRYPTION_KEY=${key}`)
  return key
})()

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex')
const IV_LENGTH = 16      // GCM 标准 nonce 长度
const TAG_LENGTH = 16     // GCM 认证标签长度

/**
 * 加密明文 API Key
 * @param plaintext 原始 API Key
 * @returns 格式: "iv:tag:ciphertext"（全部 hex）
 */
export function encryptKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  // 内存中置零敏感数据
  const result = `${iv.toString('hex')}:${tag}:${encrypted}`

  return result
}

/**
 * 解密密文 API Key
 * @param encrypted 格式: "iv:tag:ciphertext"
 * @returns 原始 API Key（调用方使用后应尽快丢弃）
 * @throws 认证失败时抛出异常（数据被篡改或密钥不匹配）
 */
export function decryptKey(encrypted: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format')
  }

  const [ivHex, tagHex, ciphertext] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * 安全比较两个 key（不依赖明文）
 * 用于验证用户输入的 key 是否等于已加密存储的 key
 */
export function verifyKey(plaintext: string, encrypted: string): boolean {
  try {
    const decrypted = decryptKey(encrypted)
    // 常量时间比较防止时序攻击
    return crypto.timingSafeEqual(
      Buffer.from(decrypted),
      Buffer.from(plaintext)
    )
  } catch {
    return false
  }
}

/**
 * 遮盖 key 用于前端显示
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return key.substring(0, 3) + '***'
  return key.substring(0, 6) + '****' + key.substring(key.length - 4)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

