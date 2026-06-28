/**
 * runtime-observability/index.ts
 *
 * Runtime Observability Bridge — 契约实现层
 *
 * 职责：
 *   将 RuntimeObservability interface 的调用桥接到现有三层观测系统：
 *     1. observability/metrics.ts  — 系统级滑动窗口指标
 *     2. observability/trace.ts    — 全链路 span 追踪
 *     3. execution-trace/trace.service.ts — 执行时序记录
 *
 * 设计约束：
 *   - 不新增存储层
 *   - 不新增 DB 表
 *   - 所有调用非阻塞（sync write to memory, fire-and-forget to DB）
 */

import type {
  RuntimeObservability,
  TraceCtx,
  MemorySampleEvent,
  FrameGenerateEvent,
  FFmpegEvent,
  TempStorageEvent,
  PartialSuccessStats,
  RuntimeEvent,
  RuntimeEventPayload,
  RuntimeEventType,
} from './types.js'

import { recordRequest, recordQueueWait, recordQueueProcessing } from '../observability/metrics.js'
import { addSpan, closeSpan, createTrace, completeTrace } from '../observability/trace.js'
import { traceService } from '../execution-trace/index.js'

// ── 事件订阅者（可选，供 future timeline replay 消费） ──
type RuntimeEventSubscriber = (event: RuntimeEvent) => void
const eventSubscribers: RuntimeEventSubscriber[] = []

export function subscribeRuntimeEvents(cb: RuntimeEventSubscriber): () => void {
  eventSubscribers.push(cb)
  return () => {
    const idx = eventSubscribers.indexOf(cb)
    if (idx !== -1) eventSubscribers.splice(idx, 1)
  }
}

function emitEvent(type: RuntimeEventType, ctx: TraceCtx, payload: RuntimeEventPayload): void {
  const event: RuntimeEvent = { type, ts: Date.now(), ctx, payload }
  for (const cb of eventSubscribers) {
    try { cb(event) } catch { /* subscriber 不阻塞主通道 */ }
  }
}

/** 
 * 将 ctx.traceId 解析为 execution-trace service 内部存储的 traceId
 * 通过 traceIdMap 映射自动生成的 ID → pipeline traceId
 */
function resolveExecTraceId(ctxTraceId: string): string {
  for (const [autoId, pipelineId] of traceIdMap) {
    if (pipelineId === ctxTraceId) return autoId
  }
  return ctxTraceId
}

// ── 工具：从 TraceCtx 构建 trace（首次才创建，幂等） ──

const createdTraces = new Set<string>()
/** traceId 映射表：execution-trace 的自动生成 ID → pipeline traceId */
const traceIdMap = new Map<string, string>()

function ensureTrace(ctx: TraceCtx): void {
  if (createdTraces.has(ctx.traceId)) return
  createdTraces.add(ctx.traceId)

  // ⭐ Fix: use ctx.traceId as the trace storage key (no more random UUID mismatch)
  // Pass ctx.traceId as traceIdOverride so observability/trace.ts uses pipeline's traceId
  createTrace({
    userId: ctx.userId,
    projectId: ctx.projectId,
    taskId: ctx.pipelineId,
  }, ctx.traceId)

  // For execution-trace: store auto-generated ID → ctx.traceId mapping
  const execTraceId = traceService.startTrace({
    userId: ctx.userId,
    requestId: ctx.traceId,
    taskType: 'video-pipeline',
    provider: 'runtime',
    model: 'runtime-observability',
    input: { pipelineId: ctx.pipelineId, projectId: ctx.projectId },
  })
  if (execTraceId !== ctx.traceId) {
    traceIdMap.set(execTraceId, ctx.traceId)
  }
}

// ── 实现 ──

export function createRuntimeObservability(): RuntimeObservability {
  return new RuntimeObservabilityImpl()
}

class RuntimeObservabilityImpl implements RuntimeObservability {
  recordMemorySample(sample: MemorySampleEvent, ctx: TraceCtx): void {
    ensureTrace(ctx)

    // metrics 层：用 recordRequest 模拟采样标记
    recordRequest(true, 0, 'memory')

    // trace 层：span
    addSpan(ctx.traceId, `memory:${sample.phase}`, 'ok', {
      heapUsedMb: sample.heapUsedMb,
      heapTotalMb: sample.heapTotalMb,
      rssMb: sample.rssMb,
      externalMb: sample.externalMb,
    })

    // execution trace：step
    traceService.addStep(resolveExecTraceId(ctx.traceId), {
      name: `memory:${sample.phase}`,
      data: {
        heapUsedMb: sample.heapUsedMb,
        rssMb: sample.rssMb,
      },
    })

    emitEvent('memory', ctx, sample)
  }

  recordTempStorage(event: TempStorageEvent, ctx: TraceCtx): void {
    ensureTrace(ctx)

    // metrics 层
    recordRequest(true, 0, 'temp')

    // trace 层：span
    addSpan(ctx.traceId, `temp:${event.phase}:${event.phase === 'cleanup' ? 'reclaim' : 'alloc'}`, 'ok', {
      bytes: event.bytes,
      phase: event.phase,
    })

    // execution trace
    traceService.addStep(resolveExecTraceId(ctx.traceId), {
      name: `temp:${event.phase}`,
      data: { bytes: event.bytes },
    })

    emitEvent('temp', ctx, event)
  }

  recordFrameGenerated(event: FrameGenerateEvent, ctx: TraceCtx): void {
    ensureTrace(ctx)

    // metrics 层：按 provider 分类
    recordRequest(event.success, event.durationMs, event.provider)

    // trace 层：span（ctx.frameExecutionId 粒度时做 span 细分）
    const spanName = ctx.frameExecutionId
      ? `frame:${event.frameIndex}:${ctx.frameExecutionId.substring(0, 8)}`
      : `frame:${event.frameIndex}`

    addSpan(ctx.traceId, spanName, event.success ? 'ok' : 'error', {
      durationMs: event.durationMs,
      provider: event.provider,
      model: event.model,
      retryCount: event.retryCount,
      errorCode: event.errorCode || undefined,
    })

    // execution trace
    traceService.addStep(resolveExecTraceId(ctx.traceId), {
      name: spanName,
      timestamp: Date.now() - event.durationMs,
      data: {
        frameIndex: event.frameIndex,
        durationMs: event.durationMs,
        success: event.success,
        provider: event.provider,
        retryCount: event.retryCount,
        errorCode: event.errorCode,
      },
    })

    // 记录队列处理时间（如果 frame 有 duration）
    recordQueueProcessing(event.durationMs)

    emitEvent('frame', ctx, event)
  }

  recordPartialSuccess(stats: PartialSuccessStats, ctx: TraceCtx): void {
    ensureTrace(ctx)

    // metrics 层：partial success 记录为一次 request
    recordRequest(stats.succeeded === stats.total, 0, 'pipeline')

    // trace 层
    addSpan(ctx.traceId, 'partial:result', stats.succeeded > 0 ? 'ok' : 'error', {
      succeeded: stats.succeeded,
      total: stats.total,
      ratio: stats.succeededRatio,
      failedIndices: stats.failedIndices,
    })

    // execution trace：标记完成（finish）
    if (stats.succeeded > 0) {
      traceService.finishTrace(resolveExecTraceId(ctx.traceId), {
        partialSuccess: stats.succeeded < stats.total,
        succeeded: stats.succeeded,
        total: stats.total,
        failedIndices: stats.failedIndices,
      })
    } else {
      traceService.failTrace(resolveExecTraceId(ctx.traceId), `全帧失败: ${stats.succeededRatio}`)
    }

    // 通知 observability trace 系统
    completeTrace(ctx.traceId, stats.succeeded === stats.total ? undefined : `partial: ${stats.succeededRatio}`)

    // 清理 trace 创建缓存
    createdTraces.delete(ctx.traceId)

    emitEvent('partial', ctx, stats)
  }

  recordFFmpegEvent(event: FFmpegEvent, ctx: TraceCtx): void {
    ensureTrace(ctx)

    // metrics 层：ffmpeg 视为一个 provider 调用
    recordRequest(event.phase !== 'start', event.durationMs || 0, 'ffmpeg')

    // trace 层
    addSpan(ctx.traceId, `ffmpeg:${event.phase}`, event.phase === 'fallback' ? 'error' : 'ok', {
      mode: event.mode,
      frameCount: event.frameCount,
      durationMs: event.durationMs,
    })

    // execution trace
    const spanName = event.phase === 'fallback' ? `ffmpeg:fallback_to_${event.mode}` : `ffmpeg:${event.mode}`
    traceService.addStep(resolveExecTraceId(ctx.traceId), {
      name: spanName,
      data: {
        phase: event.phase,
        mode: event.mode,
        frameCount: event.frameCount,
        durationMs: event.durationMs,
      },
    })

    emitEvent('ffmpeg', ctx, event)
  }
}

// ── 默认实例（全局单例，供 pipeline 直接 import 使用） ──

export const runtimeObservability: RuntimeObservability = new RuntimeObservabilityImpl()

/**
 * 清理 trace 缓存（主要在测试中使用）
 */
export function resetTraceCache(): void {
  createdTraces.clear()
}
