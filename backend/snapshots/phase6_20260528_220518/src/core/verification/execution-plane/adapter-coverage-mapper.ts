/**
 * EPVH — AdapterCoverageMapper（适配器覆盖映射器）
 *
 * 验证所有 Capability 是否都已注册到 ModelAdapterRegistry。
 * 检测是否有 capability 绕过适配器。
 *
 * ═══ 宪法 ═══
 * 所有 capability 必须经 adapter 执行。
 * adapter coverage = 100% 是单执行平面的前提条件。
 */

import { Capability } from '../../runtime/capabilities.js'
import { modelAdapterRegistry } from '../../../model-adapters/registry.js'

export interface CoverageEntry {
  capability: string
  /** 是否已注册到 adapter */
  adapted: boolean
  /** 支持的模型列表 */
  supportedModels: string[]
  /** 缺失说明 */
  gap?: string
}

export interface CoverageReport {
  timestamp: number
  coverage: CoverageEntry[]
  overallAdapted: boolean
  adaptedCount: number
  totalCount: number
  gaps: string[]
}

class AdapterCoverageMapper {
  /**
   * Capability → 期望的 adapter 模型前缀映射
   */
  private capabilityModelMap: Record<string, string[]> = {
    [Capability.SCRIPT_ANALYSIS]: ['deepseek', 'openai-compat'],
    [Capability.CINEMATIC_PROMPT]: ['deepseek', 'openai-compat'],
    [Capability.IMAGE_GENERATION]: ['wan', 'qwen-image', 'seedream', 'siliconflow', 'dalle'],
    [Capability.VIDEO_GENERATION]: ['wan', 'doubao-seedance'],
    [Capability.TTS]: ['qwen3-tts', 'cosyvoice', 'siliconflow'],
    [Capability.PROMPT_OPTIMIZATION]: ['deepseek', 'openai-compat'],
    [Capability.STORY_EXPANSION]: ['deepseek', 'openai-compat'],
    [Capability.DIRECTOR_REASONING]: ['deepseek', 'openai-compat'],
  }

  /**
   * 构建适配器覆盖报告
   */
  build(): CoverageReport {
    const coverage: CoverageEntry[] = []
    const gaps: string[] = []

    for (const [cap, expectedModels] of Object.entries(this.capabilityModelMap)) {
      // 检查 adapter 是否支持这些模型
      const supportedModels: string[] = []
      let adapted = false

      for (const expected of expectedModels) {
        try {
          const adapter = (modelAdapterRegistry as any).prefixIndex?.get(expected) ||
                          (modelAdapterRegistry as any).adapters?.get(expected)
          if (adapter) {
            supportedModels.push(expected)
            adapted = true
          }
        } catch {
          // registry 可能还未初始化
        }
      }

      if (!adapted) {
        gaps.push(`${cap}: 期望 ${expectedModels.join(', ')}，未找到适配器`)
      }

      coverage.push({
        capability: cap,
        adapted,
        supportedModels,
        gap: adapted ? undefined : `未找到适配器`,
      })
    }

    const adaptedCount = coverage.filter(c => c.adapted).length

    return {
      timestamp: Date.now(),
      coverage,
      overallAdapted: adaptedCount === coverage.length,
      adaptedCount,
      totalCount: coverage.length,
      gaps,
    }
  }
}

export const adapterCoverageMapper = new AdapterCoverageMapper()
