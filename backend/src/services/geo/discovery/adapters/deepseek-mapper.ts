// ============================================================
// DeepSeekSignalMapper — DeepSeek 原始响应 → DiscoverySignal
//
// DeepSeek 的 Presence Prompt 设计为返回固定 JSON 格式：
// {
//   "visibility": "visible" | "partial" | "missing" | "unknown",
//   "knowledgeQuality": 0-100,
//   "confidence": 0-100,
//   "evidenceCount": 0,
//   "summary": "...",
//   "recommendations": ["...", "...", "..."]
// }
// ============================================================

import type { DiscoverySignal } from '../../domain/discovery-signal.js'
import type { SignalMapper, SignalMapperContext } from './signal-mapper.js'
import { createSignal } from '../contracts/signal-version.js'

export class DeepSeekSignalMapper implements SignalMapper {
  readonly provider = 'deepseek'

  canMap(rawResponse: string): boolean {
    try {
      const parsed = JSON.parse(rawResponse)
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        (typeof parsed.visibility === 'string' || typeof parsed.confidence === 'number')
      )
    } catch {
      return false
    }
  }

  map(rawResponse: string, ctx: SignalMapperContext): DiscoverySignal[] {
    try {
      const parsed = JSON.parse(rawResponse)

      // 从 visibility 字符串转为数值
      const presenceVal = this.visibilityToScore(parsed.visibility)
      const confidenceVal = (parsed.confidence ?? 50) / 100
      const knowledgeVal = (parsed.knowledgeQuality ?? 50) / 100

      const signals: DiscoverySignal[] = []
      const now = new Date().toISOString()
      const ctxCost = { executionId: ctx.executionId, tokensIn: ctx.tokensIn, tokensOut: ctx.tokensOut, latencyMs: ctx.latencyMs }

      // Signal 1: Presence — 品牌在 AI 训练数据中的存在感
      signals.push(createSignal('presence', ctx.provider, confidenceVal, [
        {
          summary: parsed.summary || `${ctx.entityName} 在 ${ctx.provider} 中的可见性: ${parsed.visibility}`,
          source: ctx.provider,
          confidence: confidenceVal,
        },
      ], ctxCost, rawResponse))

      // Signal 2: Knowledge — AI 对该品牌的知识覆盖深度
      signals.push(createSignal('knowledge', ctx.provider, knowledgeVal, [
        {
          summary: `知识覆盖评分: ${parsed.knowledgeQuality ?? 'N/A'}/100`,
          source: ctx.provider,
          confidence: knowledgeVal,
        },
      ], ctxCost))

      // Signal 3: Search — 如果有 recommendations 则映射为 search signal
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        signals.push(createSignal('search', ctx.provider, confidenceVal, parsed.recommendations.slice(0, 3).map((r: string) => ({
          summary: r,
          source: ctx.provider,
          confidence: confidenceVal,
        })), ctxCost))
      }

      return signals
    } catch (err) {
      console.error(`[DeepSeekMapper] 映射失败:`, err)
      return []
    }
  }

  private visibilityToScore(v: string | undefined): number {
    switch (v) {
      case 'visible':
        return 85
      case 'partial':
        return 50
      case 'missing':
        return 10
      default:
        return 0
    }
  }
}
