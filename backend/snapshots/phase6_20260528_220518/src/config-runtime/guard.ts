/**
 * config-runtime/guard.ts
 *
 * 执行护栏 — 强制配置完整性检查
 * 任何失败直接抛错，不静默 skip
 */

import { RuntimeConfigContext } from './types'

export function assertConfigIntegrity(ctx: RuntimeConfigContext): true {
  const errors: string[] = []

  if (!ctx.system?.cryptoEncryptionKey) {
    errors.push('系统加密密钥未冻结')
  }

  if (ctx.user && !ctx.user.apiKey) {
    errors.push(`用户 ${ctx.requestId.substring(0, 8)} 的 API Key 为空`)
  }

  if (ctx.user && !ctx.user.model) {
    errors.push(`用户 ${ctx.requestId.substring(0, 8)} 的模型未配置`)
  }

  if (errors.length > 0) {
    console.error('[CONFIG_GUARD] ❌ 配置完整性违规:', errors)
    throw new Error(`[CONFIG_GUARD] 配置完整性违规: ${errors.join('; ')}`)
  }

  return true
}
