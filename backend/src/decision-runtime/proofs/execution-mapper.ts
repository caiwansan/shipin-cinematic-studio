/**
 * execution-mapper.ts — Phase B-0 Proof Engine
 *
 * ============================================================
 * Execution Mapping Layer
 * ============================================================
 *
 * 职责：x → Trace(x), p(x) → Trace(p(x))
 * 不允许：判断、比较、输出 "通过/不通过"
 *
 * 宪法约束：
 *   1. 不修改 DecisionRuntime 的内部逻辑
 *   2. 不注入任何评分/比较逻辑
 *   3. 映射前后保持 Trace 结构完全可回放
 */

import { DecisionRuntime } from '../runtime/decision-runtime.js'
import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { PerturbationPath } from './perturbation-space-generator.js'
import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 执行映射配置
// ============================================================

export interface ExecutionMappingConfig {
  /** 是否启用执行日志 */
  verbose: boolean
  /** 超时（毫秒） */
  timeoutMs: number
}

const DEFAULT_CONFIG: ExecutionMappingConfig = {
  verbose: false,
  timeoutMs: 30000,
}

// ============================================================
// 2. 映射结果类型
// ============================================================

/** 单条扰动路径的执行映射结果 */
export interface ExecutionMappingResult {
  /** 扰动路径 ID */
  pathId: string
  /** 映射类型 */
  mappingType: 'reference' | 'perturbed'
  /** 执行 Trace */
  trace: DecisionTrace
  /** 执行用时（毫秒） */
  durationMs: number
  /** 是否有执行错误 */
  hasError: boolean
  /** 错误信息 */
  error?: string
}

/** 完整映射空间 */
export interface ExecutionMappingSpace {
  /** 扰动空间大小 */
  totalPaths: number
  /** 成功映射数 */
  succeededCount: number
  /** 失败映射数 */
  failedCount: number
  /** 参考路径 */
  reference: ExecutionMappingResult
  /** 扰动路径映射集合 */
  perturbedResults: ExecutionMappingResult[]
  /** 生成时间 */
  createdAt: number
}

// ============================================================
// 3. 执行映射器
// ============================================================

/**
 * 映射 x → Trace(x)
 *
 * 执行零扰动参考路径，返回 DecisionTrace
 */
export async function mapReference(
  input: string,
  config?: Partial<ExecutionMappingConfig>,
): Promise<ExecutionMappingResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const startTime = Date.now()

  try {
    const runtime = new DecisionRuntime()
    const trace = await runtime.run(input)
    const durationMs = Date.now() - startTime

    return {
      pathId: 'reference',
      mappingType: 'reference',
      trace,
      durationMs,
      hasError: false,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const error = err instanceof Error ? err.message : String(err)
    // 参考路径不应该失败，但如果失败了，仍然返回有 error 标记的 Trace
    return {
      pathId: 'reference',
      mappingType: 'reference',
      trace: {
        traceId: 'reference_failed',
        runtimeId: 'proof_engine',
        rawInput: input,
        status: 'failed',
        nodes: [],
        events: [],
        createdAt: startTime,
      },
      durationMs,
      hasError: true,
      error,
    }
  }
}

/**
 * 映射 p(x) → Trace(p(x))
 *
 * 在扰动路径下执行 DecisionRuntime，返回带扰动的 DecisionTrace。
 * 注意：当前实现中扰动通过修改输入/上下文间接实现，
 * 后续可在 DecisionRuntime 注入扰动参数。
 */
export async function mapPerturbed(
  input: string,
  path: PerturbationPath,
  config?: Partial<ExecutionMappingConfig>,
): Promise<ExecutionMappingResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const startTime = Date.now()

  try {
    // 构造扰动输入（注入噪声到原始输入）
    const perturbedInput = buildPerturbedInput(input, path)
    const runtime = new DecisionRuntime()
    const trace = await runtime.run(perturbedInput)
    const durationMs = Date.now() - startTime

    return {
      pathId: path.id,
      mappingType: 'perturbed',
      trace,
      durationMs,
      hasError: false,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const error = err instanceof Error ? err.message : String(err)
    return {
      pathId: path.id,
      mappingType: 'perturbed',
      trace: {
        traceId: `${path.id}_failed`,
        runtimeId: 'proof_engine',
        rawInput: buildPerturbedInput(input, path),
        status: 'failed',
        nodes: [],
        events: [],
        createdAt: startTime,
      },
      durationMs,
      hasError: true,
      error,
    }
  }
}

/**
 * 映射完整扰动空间
 */
export async function mapExecutionSpace(
  input: string,
  paths: PerturbationPath[],
  config?: Partial<ExecutionMappingConfig>,
  domain?: DomainType,
): Promise<ExecutionMappingSpace> {
  const reference = await mapReference(input, config)

  const perturbedResults: ExecutionMappingResult[] = []
  for (const path of paths) {
    const result = await mapPerturbed(input, path, config)
    perturbedResults.push(result)
  }

  const succeededCount = perturbedResults.filter(r => !r.hasError).length
  const failedCount = perturbedResults.length - succeededCount

  return {
    totalPaths: paths.length + 1, // +1 for reference
    succeededCount: succeededCount + (reference.hasError ? 0 : 1),
    failedCount: failedCount + (reference.hasError ? 1 : 0),
    reference,
    perturbedResults,
    createdAt: Date.now(),
  }
}

// ============================================================
// 4. 扰动注入辅助
// ============================================================

/**
 * 根据扰动路径构造扰动输入
 *
 * 注意：这是 Phase B-0 的实现方式——通过修改输入字符串
 * 来间接模拟各层扰动。后续 Phase B 可升级为直接向
 * DecisionRuntime 注入扰动参数。
 */
function buildPerturbedInput(original: string, path: PerturbationPath): string {
  if (path.ops.length === 0) return original

  let result = original

  for (const op of path.ops) {
    switch (op.type) {
      // Signal Layer 扰动：通过输入修饰模拟
      case 'source_bias':
      case 'missing_entities':
      case 'duplicated_entities':
      case 'timestamp_jitter':
      case 'confidence_noise':
      case 'value_noise':
        // 当前使用输入前缀标记扰动类型
        // 后续通过 DecisionRuntime 的扰动适配器注入
        result = `[${op.layer}:${op.type}:${op.strength}] ${result}`
        break

      // Orchestration Layer 扰动
      case 'signal_ordering':
      case 'conflict_strategy_swap':
      case 'priority_weight_jitter':
      case 'filter_threshold_shift':
        result = `[${op.layer}:${op.type}:${op.strength}] ${result}`
        break

      // Grounding Layer 扰动
      case 'reliability_scaling':
      case 'volatility_injection':
      case 'drift_amplification':
      case 'signal_aggregation':
        result = `[${op.layer}:${op.type}:${op.strength}] ${result}`
        break
    }
  }

  return result
}
