/**
 * Pipeline Metrics — 统一可观测层
 *
 * ═══════════════════════════════════════════════════════════════
 * A4.5 P2: Pipeline Metrics
 *
 * 四类指标：
 *   ① Performance — 每阶段耗时
 *   ② Quality — Capability Coverage / SPS
 *   ③ Stability — Compiler Determinism / Hash 一致率
 *   ④ Architecture — Drift Statistics
 *
 * 所有 Stage 使用同一 Schema，确保 Metrics 可聚合可对比。
 * ═══════════════════════════════════════════════════════════════
 */

// ─── StageMetrics Schema ──────────────────────────────

export type PipelineStage =
  | 'Normalizer'
  | 'Compiler'
  | 'GraphBuilder'
  | 'GraphValidator'
  | 'CapabilityPlanner'
  | 'CapabilityNegotiator'
  | 'ExecutionPlanner'
  | 'Bridge'
  | 'Worker'

export interface StageMetrics {
  stage: PipelineStage
  startTime: number        // ms (Date.now())
  endTime: number          // ms
  duration: number         // ms (endTime - startTime)
  inputSize?: number       // JSON.stringify().length or count
  outputSize?: number      // JSON.stringify().length or count
  diagnostics: {
    warnings: number
    errors: number
    warningsList?: string[]
    errorsList?: string[]
  }
}

// ───  Quality Metrics ─────────────────────────────────

export interface CapabilityCoverage {
  // 按能力 ID 追踪
  [capabilityId: string]: {
    requested: number    // Capability Planner 请求了多少次
    negotiated: number   // Negotiator 保留了+降级了多少
    executed: number     // Execution DAG 包含的节点数
    succeeded: number    // Worker 实际成功的次数
  }
}

/**
 * Semantic Preservation Score（SPS）
 *
 * 衡量电影语义在 Pipeline 中的保留率。
 * 输入 → Compiler → Negotiation → Execution 的语义衰减。
 */
export interface SemanticPreservationScore {
  /** 按能力维度 */
  perCapability: Record<string, {
    initialLevel: number   // 原始请求 level（full=2, partial=1, none=0）
    preservedLevel: number // 最终执行 level
    retentionRate: number  // preservedLevel / initialLevel
  }>
  /** 总体保留率（所有能力加权平均） */
  overallRetentionRate: number
}

// ─── Stability Metrics ────────────────────────────────

export interface StabilityMetrics {
  /** Compiler 确定性验证 */
  compilerDeterminism: {
    runs: number
    hashConsistent: number   // 多少次 Hash 一致
    hashConsistencyRate: number  // hashConsistent / runs
    lastHash: string
    hashMismatchDetails?: Array<{
      run: number
      expectedHash: string
      actualHash: string
    }>
  }
}

// ─── Architecture Metrics ─────────────────────────────

export interface ArchitectureMetrics {
  driftStats: {
    ssotViolations: number        // SSOT 违反
    kernelLeaks: number           // Kernel 泄漏
    mutations: number             // DAG/Graph 非法修改
    businessAdapterLeaks: number  // 业务逻辑侵入 Adapter
  }
}

// ─── Pipeline Report ──────────────────────────────────

export interface PipelineReport {
  pipelineId: string
  projectId: string
  userId: string
  timestamp: string

  // 每阶段 Metrics
  stages: StageMetrics[]

  // 质量
  capabilityCoverage: CapabilityCoverage
  sps: SemanticPreservationScore

  // 稳定性
  stability: StabilityMetrics

  // 架构
  architecture: ArchitectureMetrics

  // 汇总
  summary: {
    totalDuration: number       // 所有 Stage 累计
    capabilityCount: number      // 涉及的能力数
    totalWarnings: number
    totalErrors: number
    sps: number                  // Overall SPS
    compilerHashConsistency: number
    driftCount: number
  }
}

// ─── Metrics Collector ────────────────────────────────

/**
 * Pipeline 指标采集器。
 *
 * 用法：
 *   const collector = new MetricsCollector('pipeline_001', 'proj_001', 'user_001')
 *   const finish = collector.start('Compiler')
 *   // ... do work ...
 *   finish({ inputSize: 100, outputSize: 200, diagnostics: { warnings: 0, errors: 0 } })
 *   const report = collector.buildReport()
 */
export class MetricsCollector {
  private pipelineId: string
  private projectId: string
  private userId: string
  private stages: StageMetrics[] = []
  private currentStage: {
    stage: PipelineStage
    startTime: number
    diagnostics: { warnings: number; errors: number; warningsList?: string[]; errorsList?: string[] }
  } | null = null

  constructor(pipelineId: string, projectId: string, userId: string) {
    this.pipelineId = pipelineId
    this.projectId = projectId
    this.userId = userId
  }

  /**
   * 开始计时一个 Stage。
   * 返回一个 finish 函数，调用时结束计时并保存 Metrics。
   *
   * 如果上一个 Stage 未结束，自动关闭它。
   */
  start(stage: PipelineStage): (overrides?: Partial<Omit<StageMetrics, 'stage' | 'startTime' | 'endTime' | 'duration'>>) => void {
    // 自动关闭上一个未结束的 Stage
    if (this.currentStage) {
      this.finishCurrent({ diagnostics: { warnings: 0, errors: 0 } })
    }

    this.currentStage = {
      stage,
      startTime: Date.now(),
      diagnostics: { warnings: 0, errors: 0 },
    }

    return (overrides = {}) => {
      if (!this.currentStage || this.currentStage.stage !== stage) {
        return // 已被其他 finish 关闭
      }
      const endTime = Date.now()
      const entry: StageMetrics = {
        stage: this.currentStage.stage,
        startTime: this.currentStage.startTime,
        endTime,
        duration: endTime - this.currentStage.startTime,
        inputSize: overrides.inputSize,
        outputSize: overrides.outputSize,
        diagnostics: {
          warnings: overrides.diagnostics?.warnings ?? 0,
          errors: overrides.diagnostics?.errors ?? 0,
          warningsList: overrides.diagnostics?.warningsList,
          errorsList: overrides.diagnostics?.errorsList,
        },
      }
      this.stages.push(entry)
      this.currentStage = null
    }
  }

  /**
   * 手动添加一个 Stage 记录（用于外部已经计时的场景）。
   */
  add(stage: StageMetrics): void {
    this.stages.push(stage)
  }

  /**
   * 构建完整 Pipeline Report。
  */
  buildReport(
    overrides?: Partial<{
      capabilityCoverage: CapabilityCoverage
      sps: SemanticPreservationScore
      stability: StabilityMetrics
      architecture: ArchitectureMetrics
    }>,
  ): PipelineReport {
    // 自动关闭未结束的 Stage
    if (this.currentStage) {
      this.finishCurrent({ diagnostics: { warnings: 0, errors: 0 } })
    }

    const totalWarnings = this.stages.reduce((s, m) => s + m.diagnostics.warnings, 0)
    const totalErrors = this.stages.reduce((s, m) => s + m.diagnostics.errors, 0)
    const totalDuration = this.stages.reduce((s, m) => s + m.duration, 0)

    return {
      pipelineId: this.pipelineId,
      projectId: this.projectId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      stages: [...this.stages],
      capabilityCoverage: overrides?.capabilityCoverage ?? {},
      sps: overrides?.sps ?? { perCapability: {}, overallRetentionRate: 0 },
      stability: overrides?.stability ?? {
        compilerDeterminism: { runs: 0, hashConsistent: 0, hashConsistencyRate: 0, lastHash: '' },
      },
      architecture: overrides?.architecture ?? {
        driftStats: { ssotViolations: 0, kernelLeaks: 0, mutations: 0, businessAdapterLeaks: 0 },
      },
      summary: {
        totalDuration,
        capabilityCount: Object.keys(overrides?.capabilityCoverage ?? {}).length,
        totalWarnings,
        totalErrors,
        sps: overrides?.sps?.overallRetentionRate ?? 0,
        compilerHashConsistency: overrides?.stability?.compilerDeterminism.hashConsistencyRate ?? 0,
        driftCount:
          (overrides?.architecture?.driftStats.ssotViolations ?? 0) +
          (overrides?.architecture?.driftStats.kernelLeaks ?? 0) +
          (overrides?.architecture?.driftStats.mutations ?? 0) +
          (overrides?.architecture?.driftStats.businessAdapterLeaks ?? 0),
      },
    }
  }

  private finishCurrent(overrides: { diagnostics: StageMetrics['diagnostics'] }): void {
    if (!this.currentStage) return
    const endTime = Date.now()
    this.stages.push({
      stage: this.currentStage.stage,
      startTime: this.currentStage.startTime,
      endTime,
      duration: endTime - this.currentStage.startTime,
      diagnostics: overrides.diagnostics,
    })
    this.currentStage = null
  }
}

// ─── 工具函数 ──────────────────────────────────────────

/**
 * 计算 SPS：输入 → 输出 的语义保留率。
 */
export function computeSPS(
  requested: Record<string, 'full' | 'partial' | 'none'>,
  executed: Record<string, 'full' | 'partial' | 'none'>,
): SemanticPreservationScore {
  const levelValue = (level: 'full' | 'partial' | 'none'): number => {
    if (level === 'full') return 2
    if (level === 'partial') return 1
    return 0
  }

  const perCapability: Record<string, { initialLevel: number; preservedLevel: number; retentionRate: number }> = {}
  let totalInitial = 0
  let totalPreserved = 0

  for (const [capId, reqLevel] of Object.entries(requested)) {
    const execLevel = executed[capId] ?? 'none'
    const initVal = levelValue(reqLevel)
    const execVal = levelValue(execLevel)
    totalInitial += initVal
    totalPreserved += execVal
    perCapability[capId] = {
      initialLevel: initVal,
      preservedLevel: execVal,
      retentionRate: initVal > 0 ? execVal / initVal : 1,
    }
  }

  return {
    perCapability,
    overallRetentionRate: totalInitial > 0 ? totalPreserved / totalInitial : 1,
  }
}
