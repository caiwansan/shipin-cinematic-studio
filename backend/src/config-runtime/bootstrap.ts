/**
 * config-runtime/bootstrap.ts
 *
 * ENV 冻结层 — bootstrap 阶段将环境变量读入 memory 并冻结
 * 之后 runtime 不再直接访问 process.env
 */

import { SystemConfigSnapshot } from './types'

let frozenSystemConfig: SystemConfigSnapshot | null = null

export function bootstrapSystemConfig(): SystemConfigSnapshot {
  if (frozenSystemConfig) return frozenSystemConfig

  const key = process.env.CRYPTO_ENCRYPTION_KEY

  if (!key) {
    throw new Error('[CONFIG_BOOTSTRAP] ❌ CRYPTO_ENCRYPTION_KEY 未设置！系统无法启动。')
  }

  if (key.length !== 64) {
    throw new Error(`[CONFIG_BOOTSTRAP] ❌ CRYPTO_ENCRYPTION_KEY 长度异常 (${key.length}，需要 64 字符 hex)`)
  }

  frozenSystemConfig = {
    cryptoEncryptionKey: key,
    envSource: 'shell',  // bootstrap 时不关心来源，只确认存在
    createdAt: new Date().toISOString(),
    frozen: true,
  }

  console.log('[CONFIG_BOOTSTRAP] ✅ 系统配置已冻结（crypto key ready）')

  return frozenSystemConfig
}

export function getSystemConfig(): SystemConfigSnapshot {
  if (!frozenSystemConfig) {
    return bootstrapSystemConfig()
  }
  return frozenSystemConfig
}

/**
 * 启动后清理 process.env 中的敏感 Key（可选）
 * 确保 runtime 不会意外读到污染的环境变量
 * 注：key 已被冻结到 memory，安全
 */
export function clearEnvSensitiveKeys(): void {
  delete process.env.CRYPTO_ENCRYPTION_KEY
  process.env.CRYPTO_ENCRYPTION_KEY_FROZEN = 'true'
}
