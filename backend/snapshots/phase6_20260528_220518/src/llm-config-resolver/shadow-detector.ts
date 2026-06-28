// llm-config-resolver/shadow-detector.ts

import type { ConfigCandidate, ShadowAlert } from './types'

export interface DetectShadowInput {
  provider: string
  finalConfig: ConfigCandidate | null
  dbV2?: Record<string, { apiKey: string; model?: string }>
  env?: Record<string, { apiKey: string; model?: string }>
  dbV1?: Record<string, { apiKey: string; model?: string }>
}

export function detectShadow(input: DetectShadowInput): { hasShadow: boolean; shadows: ShadowAlert[] } {
  const shadows: ShadowAlert[] = []
  const { provider, finalConfig, dbV2, env, dbV1 } = input

  // 1. V2 存在但未被选中
  const v2 = dbV2?.[provider]
  if (v2?.apiKey && finalConfig?.source !== 'USER_DB_V2') {
    shadows.push({
      type: 'V2_NOT_USED',
      severity: 'HIGH',
      detail: `UserModelConfigV2 存在 Key 但未命中（选中源: ${finalConfig?.source || 'none'}）`
    })
  }

  // 2. ENV 存在但未被选中（说明 ENV 可能不需要）
  const e = env?.[provider]
  if (e?.apiKey && finalConfig?.source !== 'ENV_BOOTSTRAP') {
    shadows.push({
      type: 'ENV_AVAILABLE_NOT_USED',
      severity: 'LOW',
      detail: `ENV 存在 Key 但未被使用（优先级较低）`
    })
  }

  // 3. V1 仍然存活
  const v1 = dbV1?.[provider]
  if (v1?.apiKey) {
    shadows.push({
      type: 'V1_PRESENT',
      severity: 'MEDIUM',
      detail: `V1 表 ${provider} 仍有 Key，建议迁移至 V2 后清理`
    })
  }

  // 4. 模型不匹配
  if (v2?.model && finalConfig?.model && v2.model !== finalConfig.model) {
    shadows.push({
      type: 'MODEL_MISMATCH',
      severity: 'HIGH',
      detail: `V2 期望模型: ${v2.model}，实际命中模型: ${finalConfig.model}`
    })
  }

  return {
    hasShadow: shadows.length > 0,
    shadows
  }
}
