/**
 * CKB — Knowledge Engine
 *
 * PQL 闭环 → CKB 的写入接口。
 * 提供 Quality Gate 过滤 + 自动分类写入。
 */

import type { CapabilityReport, EvaluationSummary } from './cee-types.js'
import type { OptimizationResult } from './coe-types.js'
import type { DirectorPattern, ProviderProfile, PatchPattern, GoldenCase, FailureEntry } from './ckb-types.js'
import { CKB_QUALITY_GATES } from './ckb-types.js'
import {
  DirectorPatternRepository,
  ProviderProfileRepository,
  OptimizationKnowledgeRepository,
  BenchmarkCorpusRepository,
  FailureAtlasRepository,
} from './ckb-repositories.js'

// ─── CKB Engine ───────────────────────────

export class CkbEngine {
  /** 五个 Repository */
  public directorPatterns = new DirectorPatternRepository()
  public providerProfiles = new ProviderProfileRepository()
  public optimizationKnowledge = new OptimizationKnowledgeRepository()
  public benchmarkCorpus = new BenchmarkCorpusRepository()
  public failureAtlas = new FailureAtlasRepository()

  // ─── 写入统计 ──
  private stats = { written: 0, filtered: 0 }

  get stats_() { return { ...this.stats } }

  // ─── Quality Gate ──────────────────────────

  /**
   * 判断 PQL 闭环产出是否值得写入 CKB
   * 返回 'pattern' | 'optimization' | 'failure' | 'skip'
   */
  evaluateQuality(reports: CapabilityReport[], summary: EvaluationSummary): 'pattern' | 'optimization' | 'failure' | 'skip' {
    // High score → DirectorPattern
    if (summary.overall >= CKB_QUALITY_GATES.directorPatternMinScore) {
      return 'pattern'
    }

    // 偏差分析：是否出现可修复的失败
    const failures = reports.filter(r =>
      r.severity === 'major' || r.severity === 'critical',
    )
    if (failures.length > 0) {
      return 'failure'
    }

    // 低分但有提升空间 → optimization
    const hasOptimizable = reports.some(r =>
      r.score !== undefined && r.score < 80 && r.recommendations.length > 0,
    )
    if (hasOptimizable) {
      return 'optimization'
    }

    return 'skip'
  }

  // ─── 写入方法 ─────────────────────────────

  /** 从 CapabilityReport + EvaluationSummary 写入 CKB */
  ingestFromEvaluation(
    reports: CapabilityReport[],
    summary: EvaluationSummary,
    context: {
      sceneType?: string
      provider?: string
      cirSummary?: DirectorPattern['cirSummary']
      storyType?: string
      evidenceRef?: string
    } = {},
  ): string[] {
    const quality = this.evaluateQuality(reports, summary)
    const writtenIds: string[] = []

    if (quality === 'skip') {
      this.stats.filtered++
      return writtenIds
    }

    if (quality === 'pattern') {
      const id = this.directorPatterns.insert({
        patternId: `dp_${Date.now()}`,
        sceneType: context.sceneType || 'unknown',
        provider: context.provider || 'unknown',
        cirSummary: context.cirSummary || { cameraScales: [], cameraAngles: [], motionPatterns: [], lightingMoods: [] },
        evaluation: {
          overallScore: summary.overall,
          topCapabilities: Object.entries(summary.scores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k),
          weakCapabilities: Object.entries(summary.scores)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 3)
            .map(([k]) => k),
        },
        successCount: 1,
        version: '1.0',
        createdAt: new Date().toISOString(),
        tags: [context.sceneType || 'unknown', context.provider || 'unknown'],
      })
      writtenIds.push(id)
    }

    if (quality === 'optimization') {
      for (const report of reports) {
        if (report.score === undefined || report.score >= 80) continue
        if (report.recommendations.length === 0) continue

        const id = this.optimizationKnowledge.insert({
          patternId: `opt_${Date.now()}_${report.capability}`,
          targetCapability: report.capability,
          description: report.recommendations[0]?.description || `Optimize ${report.capability}`,
          averageGain: Math.round((100 - report.score) / 2),
          gainStdDev: 5,
          sampleCount: 1,
          successRate: 0,
          applicableScenes: [context.sceneType || 'unknown'],
          version: '1.0',
          lastUpdated: new Date().toISOString(),
        })
        writtenIds.push(id)
      }
    }

    if (quality === 'failure') {
      for (const report of reports) {
        if (report.severity !== 'major' && report.severity !== 'critical') continue

        const id = this.failureAtlas.insert({
          failureId: `fail_${Date.now()}_${report.capability}`,
          failureType: `${report.capability}_failure`,
          capability: report.capability,
          provider: context.provider || 'unknown',
          sceneDescription: context.sceneType || 'unknown',
          conditions: report.deviations.map(d => d.description),
          solutions: report.recommendations.map(r => r.description),
          occurrenceCount: 1,
          lastOccurrence: new Date().toISOString(),
          version: '1.0',
        })
        writtenIds.push(id)
      }
    }

    this.stats.written += writtenIds.length
    return writtenIds
  }

  /** 从 COE OptimizationResult 写入优化知识 */
  ingestFromOptimization(
    result: OptimizationResult,
    context: {
      sceneType?: string
      provider?: string
    } = {},
  ): string[] {
    const writtenIds: string[] = []

    for (const patch of result.patches) {
      // Quality Gate：只写入 success rate 未知的新模式
      const existing = this.optimizationKnowledge.findBestPatch(patch.targetCapability)
      if (existing && existing.sampleCount > 5) continue

      const gain = patch.confidence >= 0.8 ? Math.round(patch.confidence * 15) : Math.round(patch.confidence * 8)

      const id = this.optimizationKnowledge.insert({
        patternId: `opt_coe_${Date.now()}_${patch.targetCapability}`,
        targetCapability: patch.targetCapability,
        description: patch.reason,
        averageGain: gain,
        gainStdDev: 5,
        sampleCount: 1,
        successRate: 0,
        applicableScenes: [context.sceneType || 'unknown'],
        version: '1.0',
        lastUpdated: new Date().toISOString(),
      })
      writtenIds.push(id)
    }

    this.stats.written += writtenIds.length
    return writtenIds
  }

  /** 记录一次成功验证，更新 OptimizationKnowledge 样本数 */
  recordSuccess(patternId: string, actualGain: number): boolean {
    const entry = this.optimizationKnowledge.get(patternId)
    if (!entry) return false

    entry.sampleCount++
    // 增量更新平均收益
    entry.averageGain = Math.round(
      (entry.averageGain * (entry.sampleCount - 1) + actualGain) / entry.sampleCount,
    )
    // 更新成功率
    entry.successRate = Math.round(
      ((entry.successRate * (entry.sampleCount - 1)) + (actualGain > 0 ? 100 : 0)) / entry.sampleCount,
    )
    entry.lastUpdated = new Date().toISOString()
    return true
  }

  /** 记录失败，更新 FailureAtlas */
  recordFailure(
    failure: Pick<FailureEntry, 'failureType' | 'capability' | 'provider' | 'sceneDescription' | 'conditions' | 'solutions'>,
  ): string {
    // 检查是否已有相似记录
    const existing = this.failureAtlas.findByFailureType(failure.failureType)
      .filter(f => f.provider === failure.provider && f.capability === failure.capability)

    if (existing.length > 0) {
      // 更新已有记录
      const match = existing[0]
      match.occurrenceCount++
      match.lastOccurrence = new Date().toISOString()
      // 合并解决方案
      const allSolutions = [...new Set([...match.solutions, ...failure.solutions])]
      match.solutions = allSolutions
      return match.failureId
    }

    // 新建记录
    const id = this.failureAtlas.insert({
      failureId: `fail_${Date.now()}`,
      ...failure,
      occurrenceCount: 1,
      lastOccurrence: new Date().toISOString(),
      version: '1.0',
    })
    return id
  }
}
