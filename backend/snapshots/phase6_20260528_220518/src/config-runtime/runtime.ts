/**
 * config-runtime/runtime.ts
 *
 * ⭐ 统一配置入口（核心）
 * 所有配置访问必须经过这里
 * 禁止直接读 process.env / V1 表 / V2 表
 */

import { getSystemConfig } from './bootstrap'
import { resolveUserLLMConfig, resolveUserImageConfig, resolveUserVideoConfig } from './v2-resolver'
import { RuntimeConfigContext } from './types'

export async function getRuntimeConfig(params: {
  userId: string
  requestId: string
}): Promise<RuntimeConfigContext> {
  const system = getSystemConfig()
  const user = await resolveUserLLMConfig(params.userId)

  return {
    system,
    user: user || undefined,
    requestId: params.requestId,
  }
}

export { resolveUserLLMConfig, resolveUserImageConfig, resolveUserVideoConfig } from './v2-resolver'
export { bootstrapSystemConfig, getSystemConfig, clearEnvSensitiveKeys } from './bootstrap'
export { assertConfigIntegrity } from './guard'
