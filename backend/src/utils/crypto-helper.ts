/**
 * crypto-helper.ts — 支付密钥加解密工具
 *
 * 使用 CRYPTO_ENCRYPTION_KEY 对 PaymentSecret 中的敏感字段进行 AES-256-GCM 加密。
 * 密钥配置在 .env 中，避免 DB 泄露导致支付私钥直接暴露。
 *
 * 敏感字段范围（由 SECRET_FIELDS 定义）：
 *   privateKey, publicKey, apiKey, apiV3Key, keyPem,
 *   secretKey, appSecret, mchSecret, SecretKey
 *
 * 用法：
 *   // 存
 *   const encrypted = encryptPaymentConfig(rawConfig)
 *   await prisma.paymentSecret.update({ data: { config: JSON.stringify(encrypted) } })
 *
 *   // 取
 *   const decrypted = decryptPaymentConfig(JSON.parse(record.config))
 */

import crypto from 'crypto'

/** 需要加密的敏感字段名列表 */
const SECRET_FIELDS = new Set([
  'privateKey', 'publicKey', 'apiKey', 'apiV3Key', 'keyPem',
  'secretKey', 'appSecret', 'mchSecret', 'SecretKey',
  'apiKeyPem', 'clientKeyPem', 'platformKeyPem',
])

/**
 * 获取加密密钥（来自 CRYPTO_ENCRYPTION_KEY 环境变量）
 * 密钥应为 32 字节 hex（64 字符）或 32 字节 buffer
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('[crypto-helper] CRYPTO_ENCRYPTION_KEY 未配置，无法加密支付密钥')
  }
  // 支持 32/48/64 hex 字符 → 16/24/32 bytes
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new Error(`[crypto-helper] CRYPTO_ENCRYPTION_KEY 长度无效: 期望 32/48/64 hex 字符，实际 ${keyHex.length}`)
  }
  return key
}

/**
 * AES-256-GCM 加密
 */
function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  // 格式: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * AES-256-GCM 解密
 */
function decrypt(encryptedStr: string): string {
  try {
    const key = getEncryptionKey()
    const parts = encryptedStr.split(':')
    if (parts.length !== 3) return encryptedStr // 非加密格式，原样返回
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    // 解密失败可能是旧数据（明文），原样返回
    return encryptedStr
  }
}

/**
 * 递归加密配置对象中的敏感字段
 * 非敏感字段保持原样
 */
export function encryptPaymentConfig(config: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_FIELDS.has(k) && typeof v === 'string' && v.length > 0) {
      result[k] = encrypt(v)
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[k] = encryptPaymentConfig(v)
    } else {
      result[k] = v
    }
  }
  return result
}

/**
 * 递归解密配置对象中的敏感字段
 */
export function decryptPaymentConfig(config: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_FIELDS.has(k) && typeof v === 'string' && v.length > 0) {
      result[k] = decrypt(v)
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[k] = decryptPaymentConfig(v)
    } else {
      result[k] = v
    }
  }
  return result
}

/**
 * 检查字符串是否为加密格式 (iv:authTag:ciphertext)
 */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value)
}
