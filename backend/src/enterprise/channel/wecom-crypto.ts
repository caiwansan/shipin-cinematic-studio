/**
 * P4.2.5.2-IMP-01.1 — WeCom Callback Signature Verification
 * 
 * 企业微信回调签名验证
 * https://developer.work.weixin.qq.com/document/path/90930
 */

import { createHash, createDecipheriv, createCipheriv } from 'crypto'

/**
 * 验证 WeCom 回调签名
 */
export function verifyWeComSignature(
  token: string,
  encodingAESKey: string,
  signature: string,
  timestamp: string,
  nonce: string,
  echostr?: string
): boolean {
  const shasum = createHash('sha1')
  shasum.update([token, timestamp, nonce, echostr || ''].sort().join(''))
  const calcSignature = shasum.digest('hex')
  return calcSignature === signature
}

/**
 * 验证回调签名（用于事件推送）
 */
export function verifyEventSignature(
  token: string,
  signature: string,
  timestamp: string,
  nonce: string,
  encryptedData: string
): boolean {
  const shasum = createHash('sha1')
  shasum.update([token, timestamp, nonce, encryptedData].sort().join(''))
  const calcSignature = shasum.digest('hex')
  return calcSignature === signature
}

/**
 * 解密 WeCom 消息
 * https://developer.work.weixin.qq.com/document/path/90930
 */
export function decryptWeComMessage(
  encodingAESKey: string,
  encryptedBase64: string,
  corpId: string
): { message: string; corpId: string } {
  const AESKey = Buffer.from(encodingAESKey + '=', 'base64')
  const iv = AESKey.slice(0, 16)

  const decipher = createDecipheriv('aes-256-cbc', AESKey, iv)
  decipher.setAutoPadding(false)

  const encrypted = Buffer.from(encryptedBase64, 'base64')
  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  // PKCS#7 去填充
  const pad = decrypted[decrypted.length - 1]
  const message = decrypted.slice(0, decrypted.length - pad)

  // 去掉前16位随机字符串
  const content = message.slice(16)
  // 前4位是网络字节序的 msg_len
  const msgLen = content.readUInt32BE(0)
  const msgContent = content.slice(4, 4 + msgLen).toString('utf8')
  const receivedCorpId = content.slice(4 + msgLen).toString('utf8')

  // 验证 corpId
  if (receivedCorpId !== corpId) {
    throw new Error(`corpId mismatch: expected ${corpId}, got ${receivedCorpId}`)
  }

  return { message: msgContent, corpId: receivedCorpId }
}

/**
 * 加密回复消息
 */
export function encryptWeComMessage(
  encodingAESKey: string,
  message: string,
  corpId: string,
  timestamp: string,
  nonce: string
): { encrypted: string; signature: string } {
  const AESKey = Buffer.from(encodingAESKey + '=', 'base64')
  const iv = AESKey.slice(0, 16)

  // 构造消息体
  const random = Buffer.from(
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  )
  const msgBuffer = Buffer.from(message, 'utf8')
  const msgLen = Buffer.alloc(4)
  msgLen.writeUInt32BE(msgBuffer.length, 0)
  const corpIdBuffer = Buffer.from(corpId, 'utf8')

  const plainText = Buffer.concat([random, msgLen, msgBuffer, corpIdBuffer])

  // PKCS#7 填充
  const padLen = 32 - (plainText.length % 32)
  const pad = Buffer.alloc(padLen, padLen)
  const paddedText = Buffer.concat([plainText, pad])

  // 加密
  const cipher = createCipheriv('aes-256-cbc', AESKey, iv)
  let encrypted = cipher.update(paddedText)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const encryptedBase64 = encrypted.toString('base64')

  // 生成签名
  const shasum = createHash('sha1')
  shasum.update([encodingAESKey, timestamp, nonce, encryptedBase64].sort().join(''))
  const signature = shasum.digest('hex')

  return { encrypted: encryptedBase64, signature }
}

// ─── WeCom Callback URL Verification ───────────────────────

/**
 * URL 验证（首次配置回调地址时使用）
 */
export function verifyCallbackUrl(
  token: string,
  encodingAESKey: string,
  corpId: string,
  signature: string,
  timestamp: string,
  nonce: string,
  echostr: string
): string | null {
  if (!verifyWeComSignature(token, encodingAESKey, signature, timestamp, nonce, echostr)) {
    return null
  }

  try {
    const { message } = decryptWeComMessage(encodingAESKey, echostr, corpId)
    return message
  } catch {
    return null
  }
}
