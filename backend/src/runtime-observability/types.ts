/**
 * runtime-observability/types.ts
 *
 * Runtime Observability Contract — 运行时可观测性契约
 *
 * 职责：
 *   统一 video-runtime 的观测入口，桥接 observability/metrics + trace + collector 三层。
 *   Pipeline 只依赖本文件定义的 interface，不直接 import 任何底层观测模块。
 *
 * 设计原则：
 *   - 不新增存储
 *   - 不新增 DB 表
 *   - TraceCtx 是唯一事实源（traceId / pipelineId / jobId / frameExecutionId）
 *   - RuntimeEvent 是统一事件模型（支持未来 timeline replay / flame graph）
 */

// ── 联合上下文（唯一事实源） ──

/**
 * 所有观测记录的统一钥匙。
 * 一个 pipeline 执行有唯一 (traceId, pipelineId) 对。
 * frameExecutionId 在并发帧生成时细分。
 */
export interface TraceCtx {
  /** 全链路追踪 ID */
  traceId: string
  /** 用户 ID */
  userId: string
  /** 项目 ID */
  projectId: string
  /** Pipeline 执行 ID */
  pipelineId: string
  /** 队列 Job ID（可选） */
  jobId?: string
  /** 单次帧执行 ID（可选，并发粒度细分） */
  frameExecutionId?: string
}

// ── 统一事件模型 ──

/** 运行时事件类型枚举 */
export type RuntimeEventType =
  | 'memory'
  | 'frame'
  | 'ffmpeg'
  | 'temp'
  | 'partial'

// ── 各子事件 payload ──

/** 内存采样（时间序列） */
export interface MemorySampleEvent {
  phase: 'frame_gen' | 'ffmpeg' | 'idle' | 'cleanup'
  heapUsedMb: number
  heapTotalMb: number
  rssMb: number
  externalMb: number
}

/** 单帧生成结果 */
export interface FrameGenerateEvent {
  frameIndex: number
  durationMs: number
  success: boolean
  provider: string
  model: string
  retryCount: number
  promptTokens?: number
  errorCode?: string | null
}

/** FFmpeg 合成事件（含 fallback 追踪） */
export interface FFmpegEvent {
  phase: 'start' | 'end' | 'fallback'
  durationMs?: number
  mode: 'xfade' | 'concat'
  frameCount: number
  commandLength?: number
}

/** 临时存储事件（按 phase 分类，可追踪 IO 来源） */
export interface TempStorageEvent {
  phase: 'frame_gen' | 'ffmpeg' | 'transition' | 'cleanup'
  bytes: number
  path: string
}

/** Partial success 分布统计 */
export interface PartialSuccessStats {
  succeeded: number
  total: number
  succeededRatio: string   // e.g. "7/8"
  failedIndices: number[]
  /** 失败原因分类（必须在 3 个边界 hook 处汇总） */
  failureBuckets: {
    provider: number     // provider API 返回错误
    timeout: number     // 超时（retry 后仍超时）
    ffmpeg: number     // ffmpeg 合成阶段失败
    validation: number  // 空 URL 或无效响应
  }
}

/** 统一运行时事件体（支持 timeline replay / flame graph） */
export type RuntimeEventPayload =
  | MemorySampleEvent
  | FrameGenerateEvent
  | FFmpegEvent
  | TempStorageEvent
  | PartialSuccessStats

export interface RuntimeEvent {
  type: RuntimeEventType
  ts: number
  ctx: TraceCtx
  payload: RuntimeEventPayload
}

// ── 运行时可观测性契约 ──

/**
 * RuntimeObservability — Pipeline 的唯一观测入口。
 *
 * 实现层桥接 observability/metrics + trace + collector。
 * 所有 video-runtime 代码只依赖本 interface。
 */
export interface RuntimeObservability {
  /** 内存采样（时间序列，在关键边界记录） */
  recordMemorySample(sample: MemorySampleEvent, ctx: TraceCtx): void

  /** 临时目录 IO（按 phase 分类） */
  recordTempStorage(event: TempStorageEvent, ctx: TraceCtx): void

  /** 单帧生成结果（含 provider / retry / error 上下文） */
  recordFrameGenerated(event: FrameGenerateEvent, ctx: TraceCtx): void

  /** Partial success 分布统计 */
  recordPartialSuccess(stats: PartialSuccessStats, ctx: TraceCtx): void

  /** FFmpeg 事件（含 fallback 追踪） */
  recordFFmpegEvent(event: FFmpegEvent, ctx: TraceCtx): void
}
