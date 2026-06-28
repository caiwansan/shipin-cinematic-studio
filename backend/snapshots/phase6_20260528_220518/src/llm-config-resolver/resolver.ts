// llm-config-resolver/resolver.ts
// 核心 DAG 引擎 — 按优先级解析 LLM 配置

import { CONFIG_PRIORITY_DAG } from './types'
import type { ResolveContext, ResolveResult, ConfigCandidate } from './types'
import { traceDecision } from './trace'
import { detectShadow } from './shadow-detector'

export async function resolveLLMConfig(ctx: ResolveContext): Promise<ResolveResult> {
  const trace: ResolveResult['trace'] = []
  let finalConfig: ConfigCandidate | null = null

  for (const layer of CONFIG_PRIORITY_DAG) {
    let candidate: ConfigCandidate | null = null
    let reason: string | undefined

    switch (layer) {
      case 'REQUEST_OVERRIDE': {
        const ro = ctx.runtimeOverride?.[ctx.provider]
        if (ro?.apiKey) candidate = { ...ro, source: layer }
        break
      }

      case 'USER_DB_V2': {
        const v2 = ctx.dbV2?.[ctx.provider]
        if (v2?.apiKey) candidate = { ...v2, source: layer }
        else reason = 'V2 无 Key 或未启用'
        break
      }

      case 'ENV_BOOTSTRAP': {
        const e = ctx.env?.[ctx.provider]
        if (e?.apiKey) candidate = { ...e, source: layer }
        break
      }

      case 'USER_DB_V1_LEGACY': {
        const v1 = ctx.dbV1?.[ctx.provider]
        if (v1?.apiKey) candidate = { ...v1, source: layer }
        break
      }

      case 'HARDCODE_FALLBACK':
        // 理论上不应该走到这里，兜底用
        candidate = {
          apiKey: '',
          model: 'fallback-not-configured',
          source: layer,
        }
        reason = '所有层级均无有效 Key，走到 HARDCODE_FALLBACK'
        break
    }

    if (candidate?.apiKey) {
      finalConfig = candidate
      trace.push(traceDecision(layer, ctx.provider, candidate))
      console.log(`[LLM_RESOLVER] ✅ ${layer} → ${ctx.provider}: key=${candidate.apiKey.substring(0, 6)}... model=${candidate.model || 'default'}`)
      break
    } else {
      trace.push(traceDecision(layer, ctx.provider, null, reason))
    }
  }

  const shadow = detectShadow({
    provider: ctx.provider,
    finalConfig,
    dbV2: ctx.dbV2,
    env: ctx.env,
    dbV1: ctx.dbV1,
  })

  if (shadow.hasShadow) {
    console.warn('[LLM_RESOLVER] ⚠️ Shadow config detected:', JSON.stringify(shadow.shadows))
  }

  return { config: finalConfig, trace, shadow }
}
