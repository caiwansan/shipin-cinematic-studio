// ============================================================
// Encryption Key Guard — Application startup check
// ============================================================
// P0: Detect CRYPTO_ENCRYPTION_KEY mismatch before any AI call
// P0: Never block SaaS startup — set status, let admin handle
// ============================================================

import { decryptKey } from '../../crypto.service'

export interface EncryptionGuardResult {
  /** Overall: true if all encrypted keys can be decrypted, or no keys exist */
  ok: boolean
  /** The CRYPTO_ENCRYPTION_KEY is set and non-empty */
  keyConfigured: boolean
  /** Total encrypted provider keys found in the system */
  totalEncryptedKeys: number
  /** Keys that were successfully decrypted */
  decryptedCount: number
  /** Keys that failed decryption */
  failedCount: number
  /** Details per encrypted key source */
  details: EncryptionKeyDetail[]
  /** Error message for the first failure, if any */
  firstError?: string
}

export interface EncryptionKeyDetail {
  source: string       // e.g., 'ApiKey:deepseek', 'UserModelConfigV2:9e5555de...'
  keyType: string      // e.g., 'platform', 'user'
  keyName: string      // e.g., 'deepseek_api_key'
  status: 'ok' | 'failed'
  error?: string
}

/**
 * Run encryption key guard at application startup.
 * Scans all sources of encrypted provider keys and tests decryption.
 *
 * This should run AFTER Prisma is connected but BEFORE AI routes register.
 */
export async function runEncryptionGuard(prisma: any): Promise<EncryptionGuardResult> {
  const details: EncryptionKeyDetail[] = []
  const keyConfigured = !!process.env.CRYPTO_ENCRYPTION_KEY
  let totalEncryptedKeys = 0
  let decryptedCount = 0
  let failedCount = 0
  let firstError: string | undefined

  if (!keyConfigured) {
    return {
      ok: false,
      keyConfigured: false,
      totalEncryptedKeys: 0,
      decryptedCount: 0,
      failedCount: 0,
      details: [],
      firstError: 'CRYPTO_ENCRYPTION_KEY is not set in environment',
    }
  }

  // 1. Check platform-level ApiKey table
  try {
    const platformKeys = await prisma.apiKey.findMany({ select: { provider: true, keyValue: true, keyName: true } })
    for (const key of platformKeys) {
      totalEncryptedKeys++
      try {
        decryptKey(key.keyValue)
        decryptedCount++
        details.push({
          source: `ApiKey:${key.provider}`,
          keyType: 'platform',
          keyName: key.keyName,
          status: 'ok',
        })
      } catch (err: any) {
        failedCount++
        if (!firstError) firstError = `Platform key "${key.keyName}" (${key.provider}) decryption failed: ${err.message}`
        details.push({
          source: `ApiKey:${key.provider}`,
          keyType: 'platform',
          keyName: key.keyName,
          status: 'failed',
          error: err.message,
        })
      }
    }
  } catch {
    // Table may not exist yet
  }

  // 2. Check UserModelConfigV2 table for per-user encrypted keys
  try {
    const userConfigs = await prisma.userModelConfigV2.findMany({
      select: { userId: true, llmApiKey: true, imageApiKey: true, videoApiKey: true, ttsApiKey: true },
    })
    for (const config of userConfigs) {
      const encryptedFields = [
        { field: 'llmApiKey', key: config.llmApiKey, name: 'LLM' },
        { field: 'imageApiKey', key: config.imageApiKey, name: 'Image' },
        { field: 'videoApiKey', key: config.videoApiKey, name: 'Video' },
        { field: 'ttsApiKey', key: config.ttsApiKey, name: 'TTS' },
      ]
      for (const { field: _field, key, name } of encryptedFields) {
        if (!key) continue
        totalEncryptedKeys++
        try {
          decryptKey(key)
          decryptedCount++
          details.push({
            source: `UserModelConfigV2:${config.userId}`,
            keyType: 'user',
            keyName: name,
            status: 'ok',
          })
        } catch (err: any) {
          failedCount++
          if (!firstError) firstError = `User "${config.userId}" ${name} key decryption failed: ${err.message}`
          details.push({
            source: `UserModelConfigV2:${config.userId}`,
            keyType: 'user',
            keyName: name,
            status: 'failed',
            error: err.message,
          })
        }
      }
    }
  } catch {
    // Table may not exist yet
  }

  const ok = totalEncryptedKeys === 0 || (totalEncryptedKeys > 0 && failedCount === 0)

  return {
    ok,
    keyConfigured,
    totalEncryptedKeys,
    decryptedCount,
    failedCount,
    details,
    firstError,
  }
}

/**
 * Get a human-readable summary of encryption status for admin display
 */
export function formatEncryptionStatus(result: EncryptionGuardResult): {
  severity: 'none' | 'warning' | 'error'
  title: string
  message: string
  adminAction: string
} {
  if (!result.keyConfigured) {
    return {
      severity: 'error',
      title: '加密密钥未配置',
      message: '系统环境变量 CRYPTO_ENCRYPTION_KEY 未设置，无法存储或读取 AI Provider 的 API Key。所有 AI 功能不可用。',
      adminAction: '请在服务器环境变量中配置 CRYPTO_ENCRYPTION_KEY，然后重新保存各 Provider 的 API Key。',
    }
  }

  if (result.totalEncryptedKeys === 0) {
    return {
      severity: 'none',
      title: '无可加密密钥',
      message: '系统中尚未保存任何加密的 Provider API Key。配置 Provider 后会自动加密存储。',
      adminAction: '在「大模型管理」页面为各 Provider 配置 API Key。',
    }
  }

  if (result.failedCount > 0) {
    const pct = Math.round((result.failedCount / result.totalEncryptedKeys) * 100)
    return {
      severity: 'error',
      title: `加密密钥不匹配 — ${result.failedCount}/${result.totalEncryptedKeys} 个密钥解密失败`,
      message: `当前 CRYPTO_ENCRYPTION_KEY 无法解密 ${result.failedCount} 个已存储的密钥（占比 ${pct}%）。这意味着历史保存的 API Key 已失效，AI Provider 无法正常调用。`,
      adminAction: '请重新在「大模型管理」页面录入各 Provider 的 API Key。或者恢复之前的 CRYPTO_ENCRYPTION_KEY 值。',
    }
  }

  return {
    severity: 'none',
    title: '加密系统正常',
    message: `所有 ${result.totalEncryptedKeys} 个加密密钥均可正常解密。`,
    adminAction: '',
  }
}

// Singleton: cached encryption guard result
let _guardResult: EncryptionGuardResult | null = null

export function getEncryptionGuardResult(): EncryptionGuardResult | null {
  return _guardResult
}

export function setEncryptionGuardResult(result: EncryptionGuardResult): void {
  _guardResult = result
}
