/**
 * decision-runtime.ts — Decision Runtime Skeleton
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A.1: Runtime Skeleton
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件是 Decision Runtime 的生命周期骨架。
 *
 * 固定生命周期：
 *   INIT → RUNNING → COMPLETED | FAILED
 *
 * 宪法：
 *   1. 生命周期只有三种状态，禁止随意增加
 *   2. run() / resume() / replay() 必须通过 Telemetry 包装
 *   3. 所有 Agent 调用必须记录 Trace
 *   4. 禁止 Agent 绕过 Runtime 直接调用
 *
 * @phase decision-runtime
 */

import { decisionTelemetry } from '../telemetry/decision-telemetry.js'
import { decisionObserver } from '../telemetry/decision-observer.js'
import { executionValidator } from '../validation/execution-validator.js'
import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { DecisionNodeType } from '../contracts/decision-ontology.js'
import type { DecisionEventType } from '../contracts/decision-event.js'
import type { DecisionSnapshot } from '../contracts/decision-snapshot.js'

// Phase A-0.6 Observability Enrichment
import { TelemetryHook } from '../telemetry/telemetry-hook.js'
import { StepEventType } from '../telemetry/event-types.js'

// Phase A-3.0 确定性 Agent
import { requirementAgent } from '../agents/core/requirement.agent.js'
import { searchAgent } from '../agents/core/search.agent.js'
import { evidenceAgent } from '../agents/core/evidence.agent.js'
import { scoringAgent } from '../agents/core/scoring.agent.js'
import { recommendationAgent } from '../agents/core/recommendation.agent.js'
import { reportAgent } from '../agents/core/report.agent.js'
import { getDefaultAxisWeights, createInitialFrame, validateReasoningFrame } from '../cognition/reasoning-frame.js'
import type { ReasoningFrame } from '../cognition/reasoning-frame.js'
import type { EvaluationScoreCard } from '../cognition/evaluation-schema.js'
import type { ContractCandidate, ContractEvidence, ContractRecommendation, ContractDecisionReport } from '../cognition/agent-contract.js'

// Phase A-3.1 业务智能层
import { DomainType, domainRegistry } from '../business-intelligence/domain-classifier.js'
import { businessMappingEngine } from '../business-intelligence/business-mapping-engine.js'

// Phase A-3.2 现实锚定层
import { createGroundingLayer } from '../grounding/grounding-integration.js'

// Phase A-3.3 信号编排层
import { signalOrchestrator } from '../signal-orchestration/signal-orchestrator.js'

// Phase A-4 世界接口层
import { createWorldInterface } from '../world-interface/world-interface.js'

const groundingLayer = createGroundingLayer()
const worldInterface = createWorldInterface()

// ============================================================
// 1. Runtime 状态枚举（固定三种）
// ============================================================

export enum RuntimeStatus {
  INIT = 'INIT',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ============================================================
// 2. Runtime 配置
// ============================================================

export interface DecisionRuntimeConfig {
  /**
   * 是否启用 Telemetry
   * 关闭后将不记录 Trace（仅调试用，生产环境必须开启）
   */
  enableTelemetry: boolean

  /**
   * Trace 内存保留条数
   * 超过此数量的旧 Trace 将被自动清理
   */
  maxTracesInMemory: number
}

const DEFAULT_CONFIG: DecisionRuntimeConfig = {
  enableTelemetry: true,
  maxTracesInMemory: 100,
}

// ============================================================
// 3. Decision Runtime Skeleton
// ============================================================

export class DecisionRuntime {
  private config: DecisionRuntimeConfig
  private status: RuntimeStatus = RuntimeStatus.INIT
  private currentTraceId: string | null = null

  constructor(config: Partial<DecisionRuntimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── 状态查询 ──

  getStatus(): { status: RuntimeStatus; traceId: string | null } {
    return { status: this.status, traceId: this.currentTraceId }
  }

  // ── run(): 从头执行（A-3.0 确定性 Agent Pipeline） ──

  async run(input: string): Promise<DecisionTrace> {
    if (this.status !== RuntimeStatus.INIT) {
      throw new Error(`Runtime 状态为 ${this.status}，无法执行 run()。请先创建新实例或使用 resume()`)
    }

    this.status = RuntimeStatus.RUNNING

    try {
      // 创建 Trace
      const trace = decisionTelemetry.startTrace(input)
      this.currentTraceId = trace.traceId

      // A-0.6: 创建 Telemetry Hook
      const hook = new TelemetryHook(decisionTelemetry, trace.traceId)

      console.log(`[DecisionRuntime] run() — traceId=${trace.traceId}, input="${input.slice(0, 80)}..."`)

      // ═══════════════════════════════════════════
      // Phase A-3.0: 确定性 Agent Pipeline
      // ═══════════════════════════════════════════

      // Step 1: RequirementAgent — string → DecisionProblem
      const rNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'requirement_analysis', input.slice(0, 200))
      const problem = requirementAgent.analyze(input)
      hook.emit(StepEventType.REQUIREMENT_ANALYZED, 'requirement_agent', {
        domain: problem.domain,
        constraints: problem.constraints,
        intent: problem.intent,
      } as any)
      decisionTelemetry.recordNodeFinish(trace.traceId, rNodeId, true, undefined, `领域=${problem.domain}, 约束=${problem.constraints.length}`)

      // ═══════════════════════════════════════════
      // Phase A-4: World Ingestion Step
      //    — 根据需求构建世界视图
      //    — 原始数据入口，将现实世界编译为可计算信号
      // ═══════════════════════════════════════════
      const wNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'world_ingestion', `${problem.domain} 领域`)
      const rawEntries: import('../world-interface/world-view-factory.js').RawDataEntry[] = [] // A-5 接入真实数据源后填充
      const worldView = worldInterface.ingest({
        domain: problem.domain as import('../business-intelligence/domain-classifier.js').DomainType,
        entries: rawEntries,
      })
      hook.emit(StepEventType.WORLD_VIEW_CONSTRUCTED, 'world_interface', {
        entityCount: worldView.entities.length,
        signalCount: worldView.signals.length,
        completeness: worldView.completeness,
        biasCount: worldView.biases.length,
      } as any)
      decisionTelemetry.recordNodeFinish(trace.traceId, wNodeId, true, undefined,
        `实体=${worldView.entities.length}, 信号=${worldView.signals.length}, 完整度=${worldView.completeness.toFixed(2)}, 偏差=${worldView.biases.length}`
      )

      // Step 2: 生成 ReasoningFrame
      const fNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'reasoning_frame', problem.domain)
      const domainWeights = getDefaultAxisWeights(problem.domain as any)
      const frame = createInitialFrame(problem.domain, domainWeights)
      const frameErrors = validateReasoningFrame(frame)
      if (frameErrors.length > 0) {
        decisionTelemetry.recordNodeFinish(trace.traceId, fNodeId, false, `Frame 校验失败: ${frameErrors.join('; ')}`)
        throw new Error(`ReasoningFrame 校验失败: ${frameErrors.join('; ')}`)
      }
      decisionTelemetry.recordNodeFinish(trace.traceId, fNodeId, true, undefined, `${frame.evaluationAxes.length} 个评估轴`)

      // A-0.6: Frame 事件（B-0 Frame 等价类的核心来源）
      hook.emit(StepEventType.REASONING_FRAME_CREATED, 'reasoning_agent', {
        domain: frame.problemDomain,
        axes: (frame.evaluationAxes ?? []).map(a => ({ name: a.name, weight: a.weight })),
        candidates: (frame.candidates ?? []).map(c => ({ id: c.id, name: c.name, type: c.type })),
      } as any)

      // Step 3: SearchAgent — DecisionProblem → Evidence[]
      const sNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'search', problem.domain)
      const queries = requirementAgent.generateSearchQueries(problem)
      const rawEvidences = await searchAgent.search(problem, queries)
      decisionTelemetry.recordNodeFinish(trace.traceId, sNodeId, true, undefined, `${rawEvidences.length} 条原始证据`)

      // ═══════════════════════════════════════════
      // Phase A-3.1: 业务语义映射（Frame → 业务轴）
      // ═══════════════════════════════════════════
      const domainType = problem.domain as DomainType
      if (domainRegistry.exists(domainType)) {
        const { weightMap, axes } = businessMappingEngine.mapFrameToSchema(frame, domainType)
        // 用业务层标准权重覆盖 Frame 中的权重
        for (const ax of frame.evaluationAxes) {
          if (weightMap[ax.name] !== undefined) {
            ax.weight = weightMap[ax.name]
          }
        }
        console.log(`[DecisionRuntime] 业务映射: ${domainType} → ${axes.length} 个业务轴`)
      }
      // ═══════════════════════════════════════════

      // Step 4: EvidenceAgent — normalize
      const eNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'evidence', `${rawEvidences.length} 条证据`)
      const normalizedEvidences = evidenceAgent.evaluate(rawEvidences, frame)
      hook.emit(StepEventType.EVIDENCE_COLLECTED, 'evidence_agent', {
        evidenceCount: normalizedEvidences.length,
        sources: [...new Set(normalizedEvidences.map(e => e.source))],
      } as any)
      decisionTelemetry.recordNodeFinish(trace.traceId, eNodeId, true, undefined, `${normalizedEvidences.length} 条已标准化`)

      // Step 5: ScoringAgent — 构建模拟候选进行评分
      const scNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'scoring', `${frame.evaluationAxes.length} 个评估轴`)
      const candidates: ContractCandidate[] = []
      const scoreCards: EvaluationScoreCard[] = []

      // A-3.0: 暂无可搜索内容，使用模拟候选（Phase A-4 替换）
      if (normalizedEvidences.length === 0) {
        // 创建占位候选
        const demoCandidate: ContractCandidate = {
          id: 'demo_001',
          name: '苏州河畔学区房',
          type: 'real_estate',
          description: '苏州河畔精装学区房，三室两厅，近地铁',
          evidenceIds: [],
        }
        const card = scoringAgent.score(demoCandidate, normalizedEvidences, frame)
        scoreCards.push(card)
        demoCandidate.scoreCard = card
        candidates.push(demoCandidate)
      } else {
        // 有证据时：按证据聚类构建候选
        // Phase A-3.1 替换为真实候选提取逻辑
        for (let i = 0; i < Math.min(normalizedEvidences.length, 5); i++) {
          const ev = normalizedEvidences[i]
          const candidate: ContractCandidate = {
            id: `candidate_${i}`,
            name: `候选选项 ${i + 1}`,
            type: problem.domain,
            description: ev.content.slice(0, 100),
            evidenceIds: [ev.id],
          }
          const card = scoringAgent.score(candidate, [ev], frame)
          scoreCards.push(card)
          candidate.scoreCard = card
          candidates.push(candidate)
        }
      }
      decisionTelemetry.recordNodeFinish(trace.traceId, scNodeId, true, undefined, `${scoreCards.length} 个候选已评分`)

      // A-0.6: Scoring 事件（B-0 Evaluation 等价类的核心来源）
      hook.emit(StepEventType.SCORING_COMPLETED, 'scoring_agent', {
        scores: scoreCards.map(c => ({
          candidateId: c.candidateId,
          totalScore: c.totalScore,
          axisScores: c.scores,
        })),
      } as any)

      // ═══════════════════════════════════════════
      // Phase A-3.3: Signal Orchestration Step（信号编排）
      //    — 在接地之前先编排信号
      // ═══════════════════════════════════════════
      const orNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'signal_orchestration', '编排原始信号')
      const groundingSignals: any[] = [] // A-4 数据接入后填充

      // 编排原始信号
      const orchestrationResult = signalOrchestrator.orchestrate(groundingSignals, domainType)

      // 编排后的稳定信号集
      const orchestratedSignals = orchestrationResult.finalSignals

      decisionTelemetry.recordNodeFinish(trace.traceId, orNodeId, true, undefined,
        `原始=${orchestrationResult.stages.rawCount}, 过滤=${orchestrationResult.stages.filteredCount}, 化解冲突=${orchestrationResult.conflictGroups.length}, 最终=${orchestrationResult.stages.resolvedCount}`
      )

      // ═══════════════════════════════════════════
      // Phase A-3.2: Reality Grounding Step
      //    — 用编排后的稳定信号锚定评分
      //    — 若无信号，原样传递（wasAdjusted = false）
      // ═══════════════════════════════════════════
      const gNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'grounding', `${scoreCards.length} 个评分卡`)
      const groundingResults = groundingLayer.ground(scoreCards, orchestratedSignals, {
        traceId: trace.traceId,
        requirement: input,
        domain: problem.domain,
      })
      const adjustedScoreCards = groundingResults.map(r => r.adjusted)
      const totalDrifts = groundingResults.reduce((s, r) => s + r.aggregatedDrift.signalCount, 0)
      decisionTelemetry.recordNodeFinish(trace.traceId, gNodeId, true, undefined,
        `${totalDrifts > 0 ? `有 ${totalDrifts} 个信号参与锚定` : '无信号，原样传递（wasAdjusted=' + groundingResults.every(r => !r.adjusted.wasAdjusted) + '）'}`
      )

      // Step 6: RecommendationAgent — 排序（使用调整后的评分）
      const r2NodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'recommendation', `${candidates.length} 个候选`)
      const recommendation = recommendationAgent.recommend(candidates, problem)
      hook.emit(StepEventType.RECOMMENDATION_COMPUTED, 'recommendation_agent', {
        ranking: recommendation.rankedCandidateIds.map((id, idx) => ({ candidateId: id, rank: idx + 1 })),
        primaryFactor: recommendation.reason,
      } as any)
      decisionTelemetry.recordNodeFinish(trace.traceId, r2NodeId, true, undefined, `排序完成: ${recommendation.rankedCandidateIds.length} 个推荐`)

      // Step 7: ReportAgent — 生成报告
      const rpNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'report', '生成决策报告')
      const report = reportAgent.generate({
        problem,
        frame,
        candidates,
        recommendation,
      })
      hook.emit(StepEventType.REPORT_GENERATED, 'report_agent', {
        format: report.format,
        title: report.title,
      } as any)
      decisionTelemetry.recordNodeFinish(trace.traceId, rpNodeId, true, undefined, `报告格式: ${report.format}`)

      // 记录完成事件
      decisionTelemetry.recordEvent(trace.traceId, 'decision_completed', 'runtime', {
        candidatesCount: candidates.length,
        reportFormat: report.format,
      })

      // 将最终报告注入 Trace（通过 event payload）
      decisionTelemetry.recordEvent(trace.traceId, 'report_generated', 'runtime', {
        reportTitle: report.title,
        reportSummary: report.summary,
        reportContent: report.content,
      } as any)

      // ═══════════════════════════════════════════
      // Phase A-3.0.5: 自动校验执行结果
      // ═══════════════════════════════════════════
      const vNodeId = decisionTelemetry.recordNodeStart(trace.traceId, 'validation', '决策编译器验证')
      const validationResult = executionValidator.validateTrace(trace)
      decisionTelemetry.recordNodeFinish(trace.traceId, vNodeId, validationResult.isValid,
        validationResult.isValid ? undefined : `验证失败: ${validationResult.summary}`,
        `errors=${validationResult.errors.length}, warnings=${validationResult.warnings.length}, health=${validationResult.healthScore}`
      )

      if (!validationResult.isValid) {
        decisionTelemetry.recordEvent(trace.traceId, 'validation_failed', 'runtime', {
          errors: validationResult.errors.map(e => e.message),
          healthScore: validationResult.healthScore,
        })
        console.warn(`[DecisionRuntime] ⚠️ 验证警告: ${validationResult.summary}`)
      } else {
        console.log(`[DecisionRuntime] ✅ 验证通过: ${validationResult.summary}`)
      }
      // ═══════════════════════════════════════════

      decisionTelemetry.finishTrace(trace.traceId, 'completed')
      this.status = RuntimeStatus.COMPLETED

      const finalTrace = decisionTelemetry.exportTrace(trace.traceId)!
      console.log(`[DecisionRuntime] ✅ 完成 — traceId=${trace.traceId}, durationMs=${finalTrace.durationMs}`)
      return finalTrace
    } catch (err: any) {
      if (this.currentTraceId) {
        decisionTelemetry.finishTrace(this.currentTraceId, 'failed', err.message)
      }
      this.status = RuntimeStatus.FAILED
      console.error(`[DecisionRuntime] ❌ 失败 — ${err.message}`)

      if (this.currentTraceId) {
        const failedTrace = decisionTelemetry.exportTrace(this.currentTraceId)
        if (failedTrace) return failedTrace
      }
      throw err
    }
  }

  // ── resume(): 从 Snapshot 恢复并继续执行 ──

  async resume(snapshot: DecisionSnapshot): Promise<DecisionTrace> {
    if (this.status === RuntimeStatus.RUNNING) {
      throw new Error('Runtime 正在运行中，无法 resume()')
    }

    this.status = RuntimeStatus.RUNNING

    try {
      // 从 Snapshot 恢复一条新 Trace
      const trace = decisionTelemetry.startTrace(snapshot.rawInput)
      this.currentTraceId = trace.traceId

      console.log(`[DecisionRuntime] resume() — 从 snapshot ${snapshot.id} 恢复, traceId=${trace.traceId}`)

      // ═══════════════════════════════════════════
      // Phase A.2: 从 Snapshot 已有数据继续执行
      // ═══════════════════════════════════════════

      decisionTelemetry.finishTrace(trace.traceId, 'completed')
      this.status = RuntimeStatus.COMPLETED

      const finalTrace = decisionTelemetry.exportTrace(trace.traceId)!
      return finalTrace
    } catch (err: any) {
      if (this.currentTraceId) {
        decisionTelemetry.finishTrace(this.currentTraceId, 'failed', err.message)
      }
      this.status = RuntimeStatus.FAILED
      console.error(`[DecisionRuntime] resume() ❌ — ${err.message}`)

      if (this.currentTraceId) {
        const failedTrace = decisionTelemetry.exportTrace(this.currentTraceId)
        if (failedTrace) return failedTrace
      }
      throw err
    }
  }

  // ── replay(): 从 Trace 回放（全量或增量） ──

  async replay(traceId: string): Promise<DecisionTrace> {
    this.status = RuntimeStatus.RUNNING

    try {
      const originalTrace = decisionTelemetry.getTrace(traceId)
      if (!originalTrace) {
        throw new Error(`Trace ${traceId} 不存在，无法回放`)
      }

      const newTrace = decisionTelemetry.startTrace(originalTrace.rawInput)
      this.currentTraceId = newTrace.traceId

      console.log(`[DecisionRuntime] replay() — 从 trace ${traceId} 回放, newTraceId=${newTrace.traceId}`)

      // ═══════════════════════════════════════════
      // Phase A.2: 实际回放逻辑
      // ═══════════════════════════════════════════

      decisionTelemetry.finishTrace(newTrace.traceId, 'completed')
      this.status = RuntimeStatus.COMPLETED

      const finalTrace = decisionTelemetry.exportTrace(newTrace.traceId)!
      return finalTrace
    } catch (err: any) {
      if (this.currentTraceId) {
        decisionTelemetry.finishTrace(this.currentTraceId, 'failed', err.message)
      }
      this.status = RuntimeStatus.FAILED
      console.error(`[DecisionRuntime] replay() ❌ — ${err.message}`)

      if (this.currentTraceId) {
        const failedTrace = decisionTelemetry.exportTrace(this.currentTraceId)
        if (failedTrace) return failedTrace
      }
      throw err
    }
  }

  // ── exportTrace(): 导出 Trace ──

  exportTrace(traceId: string): DecisionTrace | null {
    return decisionTelemetry.exportTrace(traceId)
  }

  // ── summarize(): 获取可读摘要 ──

  summarizeTrace(traceId: string): string | null {
    return decisionObserver.summarizeTrace(traceId)
  }

  // ── getStatusDetail(): 实时状态 ──

  getStatusDetail(traceId: string) {
    return decisionObserver.getStatus(traceId)
  }
}
