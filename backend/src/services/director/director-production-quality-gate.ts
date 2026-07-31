/**
 * services/director/director-production-quality-gate.ts
 *
 * DirectorProductionQualityGate — 生产订单质量门控
 *
 * 这是 ProductionPreparationLayer 的最后一道门。
 * 在 ExecutionPlan 进入 Task Runtime 前执行。
 *
 * 执行位置：
 *   execution/start → ProductionPreparation → 🟢 QualityGate → ExecutionPlan
 *
 * 规则：
 *   - PASS → 进入 ExecutionPlan
 *   - FAIL → 返回 STORYBOARD_PROMPT_INCOMPLETE（不静默跳过）
 */

import type {
  PreparedProductionAsset,
  ProductionQualityReport,
} from '../../types/production-preparation.js'
import { buildProductionReport } from '../../types/production-preparation.js'

// ── 门控结果 ──

export interface GateResult {
  passed: boolean
  reason?: string
  report: ProductionQualityReport
}

// ── 门控服务 ──

export class DirectorProductionQualityGate {
  /**
   * validate — 验证 PreparedProductionAsset 是否可进入生产
   *
   * @param asset 经过 Preparation 加工的生产资产
   * @param strict 是否严格模式（默认 true，要求所有字段完整）
   */
  async validate(
    asset: PreparedProductionAsset,
    strict = true,
  ): Promise<GateResult> {
    const report = buildProductionReport(asset)

    if (report.passed) {
      return {
        passed: true,
        report,
      }
    }

    // 构造 FAIL 原因
    const missingDetails: string[] = []

    for (const s of report.sceneMissing) {
      s.missingFields.forEach((f) => {
        missingDetails.push(`scene「${s.sceneName}」.${f}`)
      })
    }

    for (const c of report.characterMissing) {
      c.missingFields.forEach((f) => {
        missingDetails.push(`character「${c.characterName}」.${f}`)
      })
    }

    const reason = `STORYBOARD_PROMPT_INCOMPLETE: ${missingDetails.join(', ')}`

    return {
      passed: false,
      reason,
      report,
    }
  }
}

// ── 快捷验证函数 ──

/**
 * assertProductionReady — 快速断言生产资产就绪
 *
 * 用于路由层快速检查。如果未就绪，可立即返回。
 */
export function assertProductionReady(asset: PreparedProductionAsset): GateResult {
  const gate = new DirectorProductionQualityGate()
  // 同步版本，不调用 async（buildProductionReport 是同步的）
  const report = buildProductionReport(asset)

  if (report.passed) {
    return { passed: true, report }
  }

  const missingDetails: string[] = []
  for (const s of report.sceneMissing) {
    s.missingFields.forEach((f) => missingDetails.push(`scene「${s.sceneName}」.${f}`))
  }
  for (const c of report.characterMissing) {
    c.missingFields.forEach((f) => missingDetails.push(`character「${c.characterName}」.${f}`))
  }

  return {
    passed: false,
    reason: `STORYBOARD_PROMPT_INCOMPLETE: ${missingDetails.join(', ')}`,
    report,
  }
}
