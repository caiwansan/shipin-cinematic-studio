/**
 * Execution Context v0.1
 * ======================
 * 运行环境上下文，独立于 FilmLanguageIR。
 *
 * 原则：
 * - 它不属于电影语言，属于运行环境。
 * - 不放进 FilmIR，不参与 Diff，不参与 Migration。
 * - 在 Pipelin 中串行透传，每个 Agent/Validator/Adapter 都可以读。
 * - 如果混进 FilmIR，版本迁移、Diff、缓存都会受影响。
 */

export interface ExecutionContext {
  // ─── 请求标识 ───
  requestId: string        // 唯一请求 ID
  projectId: string        // 项目 ID
  segmentId?: string       // 片段 ID
  userId: string           // 用户 ID

  // ─── Provider ───
  provider: string         // 模型供应商（由 Execution 层注入）
  model: string            // 模型名（由 Execution 层注入）
  temperature?: number
  seed?: number

  // ─── 运行时配置 ───
  runtimeConfig: Record<string, any>  // 功能开关、运行时参数
  featureFlags: Record<string, boolean>  // 特性开关

  // ─── 追踪 ───
  retryCount: number       // 当前重试次数
  traceId: string          // 追踪 ID
  parentTraceId?: string   // 父追踪 ID

  // ─── 诊断 ───
  retryReason?: string     // 重试原因

  // ─── 性能 ───
  startTime: number        // 请求开始时间戳（ms）
}

/** 创建默认 ExecutionContext */
export function createExecutionContext(overrides: Partial<ExecutionContext> & { projectId: string; userId: string }): ExecutionContext {
  return {
    requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'pending',
    model: 'pending',
    runtimeConfig: {},
    featureFlags: {},
    retryCount: 0,
    traceId: `trace_${Date.now().toString(36)}`,
    startTime: Date.now(),
    ...overrides,
  }
}
