// ============================================================
// decision/decision-engine.ts
//
// 职责：D2 Quality Decision Engine
//   基于 ontology 校准分数做质量决策，驱动执行层
//
// 核心管线：
//   validation report → ontology mapping → quality tier →
//   decision signal (accept | retry | regenerate | escalate)
//
// 设计原则：
//   - 不修改 retry engine（retry 只处理 infra failure）
//   - decision 控制的是 "是否接受生成结果"
//   - regenerate = 修改 prompt 策略后重新生成
//   - escalate = 给人类 HITL（未来扩展）
//   - 所有决策写入 trace
// ============================================================

import type { ValidateOutput } from '../types.js'
import { getAllDomains, resolveDimensionMapping, resolveUpstreamMapping } from '../validators/core/baseline-registry.js'
import type { QualityDomain } from '../validators/core/baseline-registry.js'
import { scoreToTier, tierDescription } from '../validators/core/quality-anchor.js'
import type { QualityTier } from '../validators/core/quality-anchor.js'

// ─── 决策类型 ──────────────────────────────────────────

export type DecisionAction =
  | { type: 'accept'; reason: string }
  | { type: 'retry'; reason: string; attemptRemaining: number }
  | { type: 'regenerate'; reason: string; promptHint: string }
  | { type: 'escalate'; reason: string; severity: 'low' | 'mid' | 'high' }

export interface QualityDecision {
  /** 决策动作 */
  action: DecisionAction
  /** 触发决策的维度 */
  triggerDimension: string
  /** 触发维度的分数 */
  triggerScore: number
  /** 决策置信度（0-1） */
  confidence: number
  /** ontology 上下文 */
  context: DecisionContext
  /** 时间戳 */
  timestamp: string
}

export interface DecisionContext {
  /** 当前 domain */
  domain: QualityDomain
  /** 如果这是 retry，当前是第几次 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 下游依赖的 domain（如 character → scene） */
  downstreamDomains: { domain: QualityDomain; dependency: string }[]
  /** 上游依赖的 domain（如 scene ← character） */
  upstreamDomains: { domain: QualityDomain; dependency: string }[]
}

// ─── 决策规则配置 ──────────────────────────────────────

export interface DecisionRules {
  /** REJECT 级别触发 regenerate（默认 0.3 以下） */
  regenerateThreshold: number
  /** POOR 级别触发 retry（默认 0.3-0.5） */
  retryThreshold: number
  /** ACCEPTABLE 以上触发 accept */
  acceptThreshold: number
  /** 连续重试次数达到上限后 escalate */
  maxRegenerateAttempts: number
  /** 是否启用 ontology 映射决策增强 */
  enableOntologyPropagation: boolean
  /** 是否将决策写入 trace */
  enableTraceLogging: boolean
}

const DEFAULT_RULES: DecisionRules = {
  regenerateThreshold: 0.3,
  retryThreshold: 0.5,
  acceptThreshold: 0.5,
  maxRegenerateAttempts: 2,
  enableOntologyPropagation: true,
  enableTraceLogging: true,
}

// ─── 决策引擎 ──────────────────────────────────────────

export class DecisionEngine {
  private rules: DecisionRules

  constructor(rules: Partial<DecisionRules> = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules }
  }

  /**
   * 核心决策入口
   *
   * @param validation   validate stage 输出的质量报告
   * @param domain       当前 domain
   * @param retryCount   当前已重试次数
   * @param maxRetries   最大允许重试次数
   */
  decide(
    validation: ValidateOutput['validation'],
    domain: QualityDomain,
    retryCount = 0,
    maxRetries = 2,
  ): QualityDecision {
    const { score, issues, passed } = validation

    // ── Step 1: 低于 regenerateThreshold → regenerate ──
    if (score < this.rules.regenerateThreshold) {
      const promptHint = this.buildPromptHint(domain, issues)
      return {
        action: {
          type: 'regenerate',
          reason: `综合评分 ${score} 低于再生阈值 ${this.rules.regenerateThreshold}，需要修改 prompt 策略`,
          promptHint,
        },
        triggerDimension: 'composite',
        triggerScore: score,
        confidence: this.calculateConfidence(score, issues.length),
        context: this.buildContext(domain, retryCount, maxRetries),
        timestamp: new Date().toISOString(),
      }
    }

    // ── Step 2: 低于 retryThreshold 但还有重试次数 → retry ──
    if (score < this.rules.retryThreshold && retryCount < maxRetries) {
      const attemptRemaining = maxRetries - retryCount
      return {
        action: {
          type: 'retry',
          reason: `综合评分 ${score} 低于重试阈值 ${this.rules.retryThreshold}，剩余 ${attemptRemaining} 次`,
          attemptRemaining,
        },
        triggerDimension: 'composite',
        triggerScore: score,
        confidence: this.calculateConfidence(score, issues.length),
        context: this.buildContext(domain, retryCount, maxRetries),
        timestamp: new Date().toISOString(),
      }
    }

    // ── Step 3: 重试次数耗尽但分数仍不足 → escalate ──
    if (score < this.rules.retryThreshold && retryCount >= maxRetries) {
      return {
        action: {
          type: 'escalate',
          reason: `经过 ${retryCount} 次重试后评分仍为 ${score}，建议人工处理`,
          severity: score < this.rules.regenerateThreshold ? 'high' : 'mid',
        },
        triggerDimension: 'composite',
        triggerScore: score,
        confidence: this.calculateConfidence(score, issues.length),
        context: this.buildContext(domain, retryCount, maxRetries),
        timestamp: new Date().toISOString(),
      }
    }

    // ── Step 4: 已通过 → accept ──
    return {
      action: {
        type: 'accept',
        reason: `综合评分 ${score} 达到接受阈值，质量等级 ${tierDescription(scoreToTier(score))}`,
      },
      triggerDimension: 'composite',
      triggerScore: score,
      confidence: this.calculateConfidence(score, issues.length),
      context: this.buildContext(domain, retryCount, maxRetries),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 根据分数和 issue 数量计算决策置信度
   */
  private calculateConfidence(score: number, issueCount: number): number {
    let confidence = 0.7 // 基础置信度
    // 分数越极端越确定
    if (score < 0.2 || score > 0.8) confidence += 0.15
    // issue 越少越确定
    if (issueCount === 0) confidence += 0.1
    else if (issueCount > 3) confidence -= 0.1
    return Math.round(Math.min(1, Math.max(0.3, confidence)) * 100) / 100
  }

  /**
   * 构建决策上下文（包括 ontology 上下游映射）
   */
  private buildContext(
    domain: QualityDomain,
    retryCount: number,
    maxRetries: number,
  ): DecisionContext {
    const downstreamDomains: { domain: QualityDomain; dependency: string }[] = []
    const upstreamDomains: { domain: QualityDomain; dependency: string }[] = []

    if (this.rules.enableOntologyPropagation) {
      // 检查所有 domain 的维度映射
      const allDomains = getAllDomains()
      for (const dom of allDomains) {
        const dims = dom.dimensions as Record<string, unknown>
        for (const dim of Object.keys(dims)) {
          // 检查是否从当前 domain 的某个维度映射出去
          const outgoing = resolveDimensionMapping(domain, dim)
          for (const mapping of outgoing) {
            downstreamDomains.push({
              domain: mapping.targetDomain,
              dependency: `${dim} → ${mapping.targetDimension} (w=${mapping.semanticWeight})`,
            })
          }
          // 检查是否有映射到当前 domain 的维度
          const incoming = resolveUpstreamMapping(domain, dim)
          for (const mapping of incoming) {
            upstreamDomains.push({
              domain: mapping.sourceDomain,
              dependency: `${mapping.sourceDomain}:${mapping.sourceDimension} → ${dim} (w=${mapping.semanticWeight})`,
            })
          }
        }
      }
    }

    return { domain, retryCount, maxRetries, downstreamDomains, upstreamDomains }
  }

  /**
   * 根据 domain 和 issue 构建 prompt 优化提示
   */
  private buildPromptHint(domain: QualityDomain, issues: string[]): string {
    const hints: Partial<Record<QualityDomain, Record<string, string>>> = {
      character: {
        faceIntegrity: '增强面部细节描述，加入"五官清晰、面部比例正常、无畸变"',
        viewConsistency: '添加"角色外观在所有视角保持一致"',
        identityStability: '添加"角色面部特征统一"',
        promptFaithfulness: '简化 prompt 描述，避免过于复杂导致模型丢失关键特征',
        backgroundClean: '强化"纯白背景、纯色背景无纹理"约束',
      },
      scene: {
        composition: '添加构图引导词："居中构图、电影感、景深效果"',
        characterAppearance: '引用角色设计描述，加入"角色特征保持一致"',
        lightingConsistency: '指定光照方向："柔光、冷色调、单一光源从左上方"',
        backgroundRelevance: '强化场景描述，添加"与剧本场景氛围一致"',
        spatialCoherence: '加入"空间比例正确、透视准确"',
      },
      storyboard: {
        narrativeFlow: '添加叙事引导："镜头之间动作连贯、保持180度法则"',
        shotConsistency: '指定镜头语言："中景、平视、固定机位"',
        actionClarity: '强化动作描述："角色动作清晰可辨"',
        frameComposition: '加入构图规则："三分法构图、留白合理"',
        transitionQuality: '指定转场方式："匹配剪辑、动作衔接顺畅"',
      },
      frame: {
        temporalStability: '添加"画面稳定、无闪烁"',
        motionBlur: '加入"运动模糊自然、帧间平滑过渡"',
        colorGrading: '指定调色方向："色彩统一、风格一致"',
        resolutionQuality: '强化"高分辨率、细节丰富"',
        artifactFree: '加入"画面干净、无伪影、无失真"',
      },
      video: {
        temporalStability: '添加"画面稳定、无闪烁"',
        motionBlur: '加入"运动模糊自然、帧间平滑过渡"',
        colorGrading: '指定调色方向："色彩统一、风格一致"',
        resolutionQuality: '强化"高分辨率、细节丰富"',
        artifactFree: '加入"画面干净、无伪影、无失真"',
      },
    }

    const domainHints = hints[domain] ?? {}
    const applicable: string[] = []
    for (const issue of issues) {
      for (const [dim, hint] of Object.entries(domainHints)) {
        if (issue.toLowerCase().includes(dim.toLowerCase())) {
          applicable.push(hint)
        }
      }
    }

    // 如果 issues 未匹配到具体维度，给通用建议
    if (applicable.length === 0) {
      applicable.push('简化 prompt 描述，减少多余约束')
    }

    return applicable.slice(0, 3).join('；')
  }

  /**
   * 运行时可更新的决策规则
   */
  updateRules(patch: Partial<DecisionRules>): void {
    this.rules = { ...this.rules, ...patch }
  }
}
