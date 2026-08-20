// ============================================================
// Closed-Loop Orchestrator — Probe → Diagnose → Rewrite → Re-probe
//
// 一键闭环：探测 AI 可见度 → 诊断失败原因 → AI 改写内容 → 再探测验证
// 产品级核心：可量化验证优化效果
// ============================================================

import { runAIProbe, isAIProbeAvailable } from './ai-probe.service.js'
import { diagnoseVisibility } from './diagnosis-engine.js'
import { rewriteFromDiagnosis } from './content-rewrite-engine.js'
import type { AIProbeResult } from './ai-probe.service.js'
import type { DiagnosisReport } from './diagnosis-engine.js'
import type { RewriteResult } from './content-rewrite-engine.js'

// ── Types ──

export interface ClosedLoopReport {
  success: boolean
  /** 项目 ID */
  projectId: string
  /** 执行时间戳 */
  executedAt: string
  /** 总耗时 ms */
  totalDurationMs: number

  // Phase 1: 初始探测
  phase1_probe: {
    durationMs: number
    result: AIProbeResult | null
    score: number
    mentionRate: number
  }

  // Phase 2: 诊断
  phase2_diagnose: {
    durationMs: number
    report: DiagnosisReport | null
  }

  // Phase 3: 改写
  phase3_rewrite: {
    durationMs: number
    result: RewriteResult | null
  }

  // Phase 4: 再探测
  phase4_reprobe: {
    durationMs: number
    result: AIProbeResult | null
    score: number
    mentionRate: number
  }

  // 效果对比
  comparison: {
    /** 初始分数 */
    beforeScore: number
    /** 改写后分数 */
    afterScore: number
    /** 分数变化（可正可负） */
    scoreChange: number
    /** 初始引用率 */
    beforeMentionRate: number
    /** 改写后引用率 */
    afterMentionRate: number
    /** 引用率变化 */
    mentionRateChange: number
    /** 新增知识数 */
    knowledgeAdded: number
    /** 修改知识数 */
    knowledgeUpdated: number
  }

  /** 可读摘要 */
  summary: string
}

// ── Main: Execute Full Closed Loop ──

/**
 * 执行完整闭环优化
 * 
 * 流程：
 * 1. Probe: 探测当前 AI 可见度（基线）
 * 2. Diagnose: 分析失败原因
 * 3. Rewrite: AI 改写/补充知识内容
 * 4. Re-probe: 再探测验证效果
 * 
 * @param projectId 项目 ID
 * @returns ClosedLoopReport
 */
export async function executeFullClosedLoop(projectId: string): Promise<ClosedLoopReport> {
  const loopStart = Date.now()
  const executedAt = new Date().toISOString()

  // ── Phase 1: 初始探测 ──
  const probeStart = Date.now()
  let probeResult: AIProbeResult | null = null
  let probeScore = 0
  let probeMentionRate = 0

  if (isAIProbeAvailable()) {
    try {
      probeResult = await runAIProbe(projectId, { maxQuestionsPerEngine: 5 })
      probeScore = probeResult.overall
      const rates = probeResult.engineResults.map(e => e.mentionRate)
      probeMentionRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
    } catch {
      // probe failed
    }
  }
  const probeDuration = Date.now() - probeStart

  // ── Phase 2: 诊断 ──
  const diagnoseStart = Date.now()
  let diagnosisReport: DiagnosisReport | null = null

  if (probeResult) {
    try {
      diagnosisReport = await diagnoseVisibility(projectId, probeResult)
    } catch {
      // diagnose failed
    }
  }
  const diagnoseDuration = Date.now() - diagnoseStart

  // ── Phase 3: 改写 ──
  const rewriteStart = Date.now()
  let rewriteResult: RewriteResult | null = null

  if (diagnosisReport) {
    try {
      rewriteResult = await rewriteFromDiagnosis(projectId, diagnosisReport)
    } catch {
      // rewrite failed
    }
  }
  const rewriteDuration = Date.now() - rewriteStart

  // ── Phase 4: 再探测 ──
  const reprobeStart = Date.now()
  let reprobeResult: AIProbeResult | null = null
  let reprobeScore = 0
  let reprobeMentionRate = 0

  if (rewriteResult && rewriteResult.success && isAIProbeAvailable()) {
    try {
      // 等待 1s 让数据写入完成
      await new Promise(resolve => setTimeout(resolve, 1000))
      reprobeResult = await runAIProbe(projectId, { maxQuestionsPerEngine: 5 })
      reprobeScore = reprobeResult.overall
      const rates = reprobeResult.engineResults.map(e => e.mentionRate)
      reprobeMentionRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
    } catch {
      // reprobe failed
    }
  }
  const reprobeDuration = Date.now() - reprobeStart

  // ── Summary ──
  const scoreChange = reprobeScore - probeScore
  const mentionRateChange = reprobeMentionRate - probeMentionRate
  const knowledgeAdded = rewriteResult?.itemsCreated || 0
  const knowledgeUpdated = rewriteResult?.itemsUpdated || 0

  let summary = ''
  if (!isAIProbeAvailable()) {
    summary = 'AI 引擎未配置，无法执行闭环优化'
  } else if (!probeResult) {
    summary = '初始探测失败，请检查品牌配置'
  } else if (!diagnosisReport) {
    summary = '诊断分析失败'
  } else if (!rewriteResult || !rewriteResult.success) {
    summary = `探测完成（分数 ${probeScore}），但内容改写失败`
  } else if (!reprobeResult) {
    summary = `改写完成（+${knowledgeAdded} 条新知识，修改 ${knowledgeUpdated} 条），但再探测失败`
  } else if (scoreChange > 0) {
    summary = `✅ 闭环优化成功！AI 可见度从 ${probeScore} → ${reprobeScore}（+${scoreChange}），引用率从 ${(probeMentionRate * 100).toFixed(0)}% → ${(reprobeMentionRate * 100).toFixed(0)}%`
  } else if (scoreChange === 0) {
    summary = `AI 可见度维持 ${probeScore} 分不变，共新增 ${knowledgeAdded} 条知识`
  } else {
    summary = `⚠️ AI 可见度从 ${probeScore} 降至 ${reprobeScore}（${scoreChange}），可能需要调整策略`
  }

  return {
    success: true,
    projectId,
    executedAt,
    totalDurationMs: Date.now() - loopStart,

    phase1_probe: {
      durationMs: probeDuration,
      result: probeResult,
      score: probeScore,
      mentionRate: probeMentionRate,
    },

    phase2_diagnose: {
      durationMs: diagnoseDuration,
      report: diagnosisReport,
    },

    phase3_rewrite: {
      durationMs: rewriteDuration,
      result: rewriteResult,
    },

    phase4_reprobe: {
      durationMs: reprobeDuration,
      result: reprobeResult,
      score: reprobeScore,
      mentionRate: reprobeMentionRate,
    },

    comparison: {
      beforeScore: probeScore,
      afterScore: reprobeScore,
      scoreChange,
      beforeMentionRate: probeMentionRate,
      afterMentionRate: reprobeMentionRate,
      mentionRateChange,
      knowledgeAdded,
      knowledgeUpdated,
    },

    summary,
  }
}
