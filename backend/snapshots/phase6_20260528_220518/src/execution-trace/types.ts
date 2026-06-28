/**
 * execution-trace/types.ts — Trace 类型定义
 *
 * Execution Trace 是时间维度的执行记录器。
 * 不参与任何决策，不改变执行链。
 *
 * 数据策略：
 *   - input/output 默认只存结构摘要（长度限制 500 字）
 *   - 完整 payload 通过 debugMode 开启
 *   - 异常信息全量存储（因为它是审计关键）
 */

/** 执行步骤 */
export interface ExecutionStep {
  /** 步骤名，如 "safety-check" 或 "provider-call" */
  name: string
  /** 时间戳 (ms) */
  timestamp: number
  /** 步骤耗时 (ms) */
  durationMs?: number
  /** 结构摘要数据（非完整 payload） */
  data?: Record<string, any>
}

/** Trace 记录 */
export interface ExecutionTrace {
  /** 唯一 ID */
  id: string
  /** 用户 ID */
  userId: string
  /** 请求 ID（外部传入，可用于关联业务） */
  requestId?: string
  /** 任务类型 */
  taskType: string
  /** Provider 名 */
  provider: string
  /** 模型名 */
  model: string

  /** input 摘要（长度受限） */
  inputSummary: string
  /** output 摘要（长度受限） */
  outputSummary?: string

  /** 最终状态 */
  status: 'running' | 'success' | 'failed' | 'blocked'
  /** 错误消息（全量） */
  error?: string

  /** 开始时间 (ms) */
  startTime: number
  /** 结束时间 (ms) */
  endTime?: number

  /** 步骤序列 */
  steps: ExecutionStep[]
}

/** 生成带摘要的 input */
export function summarizeInput(input: any): string {
  if (!input) return ''
  const raw = typeof input === 'string' ? input : JSON.stringify(input)
  return raw.length > 500 ? raw.substring(0, 500) + '...' : raw
}

/** 生成带摘要的 output */
export function summarizeOutput(output: any): string {
  if (!output) return ''
  const raw = typeof output === 'string' ? output : JSON.stringify(output)
  return raw.length > 500 ? raw.substring(0, 500) + '...' : raw
}
