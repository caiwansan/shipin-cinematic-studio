/**
 * counterfactual-proof.ts — Phase B-2 Counterfactual Stability
 *
 * ============================================================
 * CounterfactualProof Schema & Builder
 * ============================================================
 *
 * B-2 核心结构：CounterfactualProof
 *
 * 不是"新证明"。
 * 是"旧证明 + delta → 变化区域 → 修复计划 → 新证明"。
 *
 * 宪法约束：
 *   1. 不调 Agent
 *   2. 不重新执行全量 Pipeline
 *   3. 只做结构差异分析 + 局部修复
 */

import type { ProofKernel } from '../b1/proof-kernel.js'
import { deltaDetector, type DeltaResult } from './delta-detector.js'
import { reuseEngine, type ReuseResult } from './reuse-engine.js'

// ============================================================
// 1. CounterfactualProof
// ============================================================

export interface CounterfactualProof {
  /** 基础证明（原输入） */
  baseProof: ProofKernel
  /** Delta 检测结果 */
  delta: DeltaResult
  /** 可复用和需重算的区域 */
  repairPlan: ReuseResult
  /** 修复后的新证明（placeholder，B-3 完全实现） */
  newProof: ProofKernel | null
  /** 是否在扰动下稳定（reuseRatio >= 0.6） */
  stable: boolean
  /** 原始输入 */
  oldInput: string
  /** 新输入 */
  newInput: string
}

// ============================================================
// 2. Counterfactual Builder
// ============================================================

export class CounterfactualBuilder {
  /**
   * 从旧证明 + 旧输入 + 新输入 构造反事实证明
   *
   * 不重新执行任何 Agent。
   * 不重新构建全量证明。
   * 只做 delta 检测 + 复用率分析 + 修复计划。
   */
  build(baseProof: ProofKernel, oldInput: string, newInput: string): CounterfactualProof {
    // Step 1: 检测 delta
    const delta = deltaDetector.detect(oldInput, newInput)

    // Step 2: 分析复用率
    const repairPlan = reuseEngine.analyze(baseProof, delta)

    // Step 3: 判断稳定性——以 frame invariant 签名前驱链是否完整为准
    const stable = this.isStable({
      baseProof,
      delta,
      repairPlan,
      newProof: null,
      stable: false, // 临时值，下面覆盖
      oldInput,
      newInput,
    })

    return {
      baseProof,
      delta,
      repairPlan,
      newProof: null, // B-3 实现完整增量构建
      stable,
      oldInput,
      newInput,
    }
  }

  /**
   * 检查反事实稳定性
   *
   * stable iff:
   *   - total reuseRatio >= 0.3（允许局部修复）
   *   - frame invariant 签名的前驱边（requirement→world→frame）不受影响
   *     ———因为 frame 不变量不变时，证明的核心语义结构不变
   */
  isStable(cp: CounterfactualProof): boolean {
    // 同输入 → 绝对稳定
    if (!cp.delta.changed) return true

    // Frame 前驱链路（requirement → world → frame）必须完整
    const frameChainEdgeTypes = [
      'requirement_analyzed→world_view_constructed',
      'world_view_constructed→reasoning_frame_created',
    ]

    const recomputedEdgeSignatures = cp.repairPlan.recomputedSteps.map(
      s => `${s.from}→${s.to}`
    )

    const frameChainIntact = !frameChainEdgeTypes.some(t =>
      recomputedEdgeSignatures.includes(t)
    )

    // 复用率不低于 30%（允许证据/评分级别的局部重算）
    const reuseSufficient = cp.repairPlan.reuseRatio >= 0.3

    return frameChainIntact && reuseSufficient
  }

  /**
   * 生成稳定度说明
   */
  describe(cp: CounterfactualProof): string {
    const parts: string[] = []

    if (cp.delta.changed) {
      parts.push(`检测到 ${cp.delta.nodes.length} 处变更`)
      for (const node of cp.delta.nodes) {
        parts.push(`  ${node.node}: "${node.oldValue}" → "${node.newValue}" (幅度 ${node.changeMagnitude})`)
      }
    } else {
      return '输入未变化，证明完全可复用 ✅'
    }

    parts.push(`影响范围: ${[...cp.delta.impactScope].join(', ')}`)
    parts.push(`复用率: ${(cp.repairPlan.reuseRatio * 100).toFixed(0)}%`)
    parts.push(`稳定性: ${cp.stable ? '✅ 稳定' : '❌ 不稳定'}`)
    parts.push(`可复用边: ${cp.repairPlan.reusedSteps.length}`)
    parts.push(`需重算边: ${cp.repairPlan.recomputedSteps.length}`)

    const sigStable = this.isStable(cp)
    parts.push(`签名稳定: ${sigStable ? '✅ YES' : '⚠️ 输入变化影响全链路'}`)

    return parts.join('\n')
  }
}

/**
 * 单例 Builder
 */
export const counterfactualBuilder = new CounterfactualBuilder()
