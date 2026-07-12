// ============================================================
// PresenceStage — Pipeline Stage: 品牌认知存在感扫描
//
// V2 变化：不直接调 Provider，也不直接写 DiscoveryContext
// 通过 SignalMapper 将 Provider Raw Response 转为 DiscoverySignal
// ============================================================

import type { DiscoveryContext } from '../../../domain/discovery-context.js'
import type { DiscoverySignal } from '../../../domain/discovery-signal.js'
import { executePresenceCall } from '../../../presence/presence-executor.js'
import { getMapper } from '../../adapters/mapper-registry.js'
import type { PipelineStage, PipelineStageOutput } from '../types.js'

export class DiscoveryPresenceStage implements PipelineStage {
  readonly id = 'presence'
  readonly name = 'AI Presence Scan'

  async execute(ctx: DiscoveryContext): Promise<PipelineStageOutput> {
    const startTime = Date.now()
    const allSignals: DiscoverySignal[] = []
    const errors: string[] = []

    // 从注册表获取已注册的 Provider（按照旧 PresenceAdapter 的注册机制）
    const providers = this.getEnabledProviders()

    for (const providerName of providers) {
      const mapper = getMapper(providerName)
      if (!mapper) {
        errors.push(`Provider ${providerName} 没有对应的 SignalMapper，跳过`)
        continue
      }

      // 构建 Presence Prompt（复用旧 PresenceAdapter 的语义）
      const prompt = this.buildPresencePrompt(ctx.entityName)

      const result = await executePresenceCall({
        provider: providerName,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        maxTokens: 512,
        temperature: 0.3,
      })

      if (!result.success) {
        errors.push(`${providerName} 调用失败: ${result.errorMessage}`)
        continue
      }

      // Mapper: Raw Response → DiscoverySignal[]
      const signals = mapper.map(result.content, {
        entityId: ctx.entityId,
        entityName: ctx.entityName,
        projectId: ctx.projectId,
        executionId: ctx.executionId || `exec-${Date.now()}`,
        provider: providerName,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: result.latencyMs,
      })

      allSignals.push(...signals)
    }

    // 将 Signal 写入 Context
    ctx.stageResults['presence'] = {
      signals: allSignals,
      errors,
      durationMs: Date.now() - startTime,
    }

    return {
      id: this.id,
      durationMs: Date.now() - startTime,
      success: errors.length === 0,
      errors,
      nextStages: ['knowledge'],
      signals: allSignals,
    }
  }

  private getEnabledProviders(): string[] {
    // 所有注册了 Mapper 的 Provider
    const { getMappers } = require('../../adapters/mapper-registry.js')
    return getMappers().map((m: { provider: string }) => m.provider)
  }

  private buildPresencePrompt(name: string): { system: string; user: string } {
    return {
      system: `You are a brand presence analyst. Analyze this brand's presence in AI training data.
Return JSON ONLY (no markdown, no explanation):
{
  "visibility": "visible" | "partial" | "missing" | "unknown",
  "knowledgeQuality": <0-100>,
  "confidence": <0-100>,
  "evidenceCount": <number>,
  "summary": "<1-2 sentences in Chinese>",
  "recommendations": ["<recommendation 1 in Chinese>"]
}`,
      user: `Analyze brand: ${name}`,
    }
  }
}
