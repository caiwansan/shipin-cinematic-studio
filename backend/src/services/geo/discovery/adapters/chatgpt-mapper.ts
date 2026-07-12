// ============================================================
// ChatGPTSignalMapper — ChatGPT 原始响应 → DiscoverySignal
//
// ChatGPT 的 Presence Prompt 返回 JSON 格式与 DeepSeek 可能不同
// 这里展示 Mapper 如何适配不同 Provider 的输出格式
// ============================================================

import type { DiscoverySignal } from '../../domain/discovery-signal.js'
import type { SignalMapper, SignalMapperContext } from './signal-mapper.js'
import { createSignal } from '../contracts/signal-version.js'

export class ChatGPTMapper implements SignalMapper {
  readonly provider = 'chatgpt'

  canMap(rawResponse: string): boolean {
    try {
      const parsed = JSON.parse(rawResponse)
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        (typeof parsed.visibility === 'string' ||
         typeof parsed.score === 'number' ||
         typeof parsed.confidence === 'number')
      )
    } catch {
      return false
    }
  }

  map(rawResponse: string, ctx: SignalMapperContext): DiscoverySignal[] {
    try {
      const parsed = JSON.parse(rawResponse)

      // ChatGPT 可能返回的字段名与 DeepSeek 不同
      const visibility = parsed.visibility || (parsed.score >= 60 ? 'visible' : parsed.score >= 20 ? 'partial' : 'missing')
      const confidenceVal = (parsed.confidence ?? parsed.score ?? 50) / 100
      const knowledgeVal = (parsed.knowledgeQuality ?? parsed.depth ?? 50) / 100

      // ChatGPT 多了 competitor 能力
      const competitorVal = parsed.competitors
        ? Math.min(1, (Array.isArray(parsed.competitors) ? parsed.competitors.length : 0) / 5)
        : 0

      const signals: DiscoverySignal[] = []
      const ctxCost = { executionId: ctx.executionId, tokensIn: ctx.tokensIn, tokensOut: ctx.tokensOut, latencyMs: ctx.latencyMs }

      // Signal 1: Presence
      signals.push(createSignal('presence', ctx.provider, confidenceVal, [
        {
          summary: parsed.summary || `${ctx.entityName} 在 ${ctx.provider} 中的可见性: ${visibility}`,
          source: ctx.provider,
          confidence: confidenceVal,
        },
      ], ctxCost, rawResponse))

      // Signal 2: Knowledge
      signals.push(createSignal('knowledge', ctx.provider, knowledgeVal, [
        {
          summary: `知识覆盖评分: ${Math.round(knowledgeVal * 100)}/100`,
          source: ctx.provider,
          confidence: knowledgeVal,
        },
      ], ctxCost))

      // Signal 3: Competitor（ChatGPT 特有）
      if (competitorVal > 0) {
        signals.push(createSignal('competition', ctx.provider, competitorVal, [
          {
            summary: `检测到 ${parsed.competitors?.length || '若干'} 个竞争对手`,
            source: ctx.provider,
            confidence: competitorVal,
          },
        ], ctxCost))
      }

      // Signal 4: Recommendations
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        signals.push(createSignal('search', ctx.provider, confidenceVal, parsed.recommendations.slice(0, 3).map((r: string) => ({
          summary: r,
          source: ctx.provider,
          confidence: confidenceVal,
        })), ctxCost))
      }

      return signals
    } catch (err) {
      console.error(`[ChatGPTMapper] 映射失败:`, err)
      return []
    }
  }
}
