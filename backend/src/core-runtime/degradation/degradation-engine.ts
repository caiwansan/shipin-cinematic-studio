// ============================================================================
// 盘古斧 AI OS — Phase 8.2b-2: Degradation Execution Engine
//
// 职责：
//   1. 根据 degradationMode 将 DAG 转化为四种执行形态
//   2. 不修改 DAG 结构本身，只决定"如何执行"
//   3. 作为 DAG Executor 的前置过滤层
// ============================================================================

export type DegradationMode =
  | 'FULL_DAG'
  | 'SIMPLIFIED_DAG'
  | 'ASYNC_BATCH'
  | 'QUEUE_ONLY'

export type ExecutionPlan = {
  /** 实际要执行的 DAG steps */
  steps: any[]
  /** 执行模式 */
  mode: DegradationMode
  /** 是否异步（不 await） */
  async: boolean
  /** 是否仅入队不执行 */
  queueOnly: boolean
  /** 统计：原始 step 数 */
  originalStepCount: number
  /** 统计：实际执行的 step 数 */
  executedStepCount: number
}

/**
 * 将 DAG + mode 解析为具体的执行计划
 *
 * FULL_DAG       → 所有 step 全跑（当前默认行为）
 * SIMPLIFIED_DAG → 只跑 steps 中 critical=true 的关键路径
 * ASYNC_BATCH    → 所有 step 标记 async，不 await 结果
 * QUEUE_ONLY     → 不入执行，只返回计划（由调用方处理入队）
 */
export function resolveExecutionPlan(
  mode: DegradationMode,
  steps: any[] = []
): ExecutionPlan {
  const safeSteps = Array.isArray(steps) ? steps : []
  const originalStepCount = safeSteps.length

  switch (mode) {
    case 'FULL_DAG':
      return {
        steps: [...safeSteps],
        mode: 'FULL_DAG',
        async: false,
        queueOnly: false,
        originalStepCount,
        executedStepCount: safeSteps.length,
      }

    case 'SIMPLIFIED_DAG':
      return simplifySteps(safeSteps)

    case 'ASYNC_BATCH':
      return {
        steps: safeSteps.map(s => ({ ...s, _async: true })),
        mode: 'ASYNC_BATCH',
        async: true,
        queueOnly: false,
        originalStepCount,
        executedStepCount: safeSteps.length,
      }

    case 'QUEUE_ONLY':
      return {
        steps: [],
        mode: 'QUEUE_ONLY',
        async: false,
        queueOnly: true,
        originalStepCount,
        executedStepCount: 0,
      }

    default:
      return {
        steps: [...steps],
        mode: 'FULL_DAG',
        async: false,
        queueOnly: false,
        originalStepCount,
        executedStepCount: steps.length,
      }
  }
}

/**
 * DAG 精简引擎
 *
 * 只保留 critical === true 的 step。
 * 如果全部 step 都非 critical，保留第一个 step（总要有事做）。
 */
export function simplifySteps(steps: any[]): ExecutionPlan {
  const critical = steps.filter(s => s.critical === true)
  const simplified = critical.length > 0 ? critical : steps.slice(0, 1)

  return {
    steps: simplified.map(s => ({ ...s, _simplified: true })),
    mode: 'SIMPLIFIED_DAG',
    async: false,
    queueOnly: false,
    originalStepCount: steps.length,
    executedStepCount: simplified.length,
  }
}

/**
 * 判断 DAG 是否需要降级（基于熔断器状态）
 * 由 Circuit Breaker 的 degrade() 输出决定
 */
export function getDegradationMode(breakerDegradation: string): DegradationMode {
  switch (breakerDegradation) {
    case 'SIMPLIFIED_DAG': return 'SIMPLIFIED_DAG'
    case 'ASYNC_BATCH':    return 'ASYNC_BATCH'
    case 'QUEUE_ONLY':     return 'QUEUE_ONLY'
    case 'REJECT':         return 'QUEUE_ONLY' // REJECT → 不执行
    default:               return 'FULL_DAG'
  }
}
