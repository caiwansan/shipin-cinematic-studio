/**
 * EPVH — ViolationReporter（违规汇总报告器）
 *
 * 统一汇总静态扫描 + 运行时追踪 + 适配器覆盖的结果。
 * 输出 CRITICAL / WARNING / INFO 三级违规报告。
 */

import { BypassFinding, StaticScanReport } from './static-path-scanner.js'
import { TraceEntry } from './runtime-call-tracer.js'
import { CoverageReport } from './adapter-coverage-mapper.js'

export interface ViolationReport {
  timestamp: number
  integrityScore: number
  bypassCount: {
    critical: number
    warning: number
    info: number
  }
  isSingleExecutionPlane: boolean
  details: {
    critical: string[]
    warning: string[]
    info: string[]
  }
  staticScan: StaticScanReport
  coverage: CoverageReport
  runtimeTraces: {
    total: number
    bypassed: number
  }
}

class ViolationReporter {
  /**
   * 生成完整违规报告
   */
  generate(
    staticReport: StaticScanReport,
    coverageReport: CoverageReport,
    runtimeTraces: TraceEntry[],
  ): ViolationReport {
    const critical: string[] = []
    const warning: string[] = []
    const info: string[] = []

    // 静态扫描发现
    const grouped = this.groupBySeverity(staticReport)

    for (const f of grouped.critical) {
      critical.push(`[${f.path}:${f.line}] ${f.detail}`)
    }
    for (const f of grouped.warning) {
      warning.push(`[${f.path}:${f.line}] ${f.detail}`)
    }
    for (const f of grouped.info) {
      info.push(`[${f.path}:${f.line}] ${f.detail}`)
    }

    // 适配器覆盖
    for (const gap of coverageReport.gaps) {
      critical.push(`[adapter-coverage] ${gap}`)
    }

    // 运行时追踪
    const runtimeBypasses = runtimeTraces.filter(t => t.bypassed)
    for (const b of runtimeBypasses) {
      critical.push(`[runtime] BYPASS: ${b.source} → ${b.path} (user=${b.userId.substring(0, 8)})`)
    }

    // 完整性评分
    const integrityScore = this.calculateScore(
      grouped.critical.length + coverageReport.gaps.length,
      grouped.warning.length,
      runtimeBypasses.length,
    )

    return {
      timestamp: Date.now(),
      integrityScore,
      bypassCount: {
        critical: grouped.critical.length + coverageReport.gaps.length + runtimeBypasses.length,
        warning: grouped.warning.length,
        info: grouped.info.length,
      },
      isSingleExecutionPlane: integrityScore >= 90,
      details: { critical, warning, info },
      staticScan: staticReport,
      coverage: coverageReport,
      runtimeTraces: {
        total: runtimeTraces.length,
        bypassed: runtimeBypasses.length,
      },
    }
  }

  /**
   * 分组静态扫描发现
   */
  private groupBySeverity(report: StaticScanReport) {
    return {
      critical: report.findings.filter(f => f.severity === 'CRITICAL'),
      warning: report.findings.filter(f => f.severity === 'WARNING'),
      info: report.findings.filter(f => f.severity === 'INFO'),
    }
  }

  /**
   * 计算完整性评分（0-100）
   *
   * 扣分规则：
   *   CRITICAL bypass: -25 each
   *   WARNING: -10 each
   *   runtime bypass: -30 each
   *   适配器缺口: -20 each
   *   基础分: 100
   */
  private calculateScore(criticalCount: number, warningCount: number, runtimeBypassCount: number): number {
    let score = 100
    score -= criticalCount * 25
    score -= warningCount * 10
    score -= runtimeBypassCount * 30
    return Math.max(0, Math.min(100, score))
  }
}

export const violationReporter = new ViolationReporter()
