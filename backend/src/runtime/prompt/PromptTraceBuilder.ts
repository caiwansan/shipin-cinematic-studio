/**
 * PromptTraceBuilder.ts — Phase 4-C Debug Mode
 *
 * 构建单次 Prompt 请求的完整决策链路 trace
 * 从 log + router + registry 重建：
 *   input → routing decision → version selection → final prompt → output → telemetry
 *
 * 原则：
 * - 纯只读重建，不修改任何数据
 * - 不评分、不推断、不解释
 * - 只做结构化和回放
 *
 * @phase-4c
 */

import { prisma } from '../../utils/index.js'

export interface PromptTraceNode {
  /** 这一步的执行阶段名称 */
  step: string
  /** 状态：完成/跳过/失败 */
  status: 'completed' | 'skipped' | 'failed'
  /** 时间戳（毫秒，相对于 trace 起点） */
  elapsedMs: number
  /** 附加详情 */
  detail?: Record<string, any>
}

export interface PromptTrace {
  requestId: string
  input: {
    raw?: string
    contextHash?: string
  }
  routing: {
    mode: string
    promptName: string
    version: string
    reason?: string
  }
  execution: {
    finalPrompt?: string
    variables?: Record<string, any>
  }
  output: {
    text?: string
    success: boolean
    latencyMs: number
  }
  telemetry: {
    logId: string
    entropyContribution?: number
    clusterId?: string
  }
  timeline: PromptTraceNode[]
  timestamp: number
}

/**
 * 根据 prompt_runtime_log 的 id（requestId）重建 trace
 *
 * @param requestId — prompt_runtime_log.id（UUID 格式）
 * @param contextInput — 可选的原始输入（从业务侧传入，因为 log 不存 input）
 */
export async function buildTrace(
  requestId: string,
  contextInput?: { raw?: string; variables?: Record<string, any>; finalPrompt?: string; outputText?: string }
): Promise<PromptTrace | { error: string }> {
  try {
    // ─── 1. 查询日志 ───
    const log = await prisma.promptRuntimeLog.findUnique({
      where: { id: requestId },
    })

    if (!log) {
      return { error: `Trace not found: requestId=${requestId}` }
    }

    // ─── 2. 构建 Timeline ───
    const baseTime = log.createdAt.getTime()
    const timeline: PromptTraceNode[] = [
      {
        step: 'Input Received',
        status: 'completed',
        elapsedMs: 0,
        detail: { contextHash: log.contextHash || undefined, hasRawInput: !!contextInput?.raw },
      },
      {
        step: 'Router Executed',
        status: 'completed',
        elapsedMs: 1,
        detail: { routingMode: log.routingMode },
      },
      {
        step: 'Version Selected',
        status: 'completed',
        elapsedMs: 2,
        detail: { version: log.version },
      },
      {
        step: 'Prompt Built',
        status: contextInput?.finalPrompt ? 'completed' : 'skipped',
        elapsedMs: 3,
        detail: contextInput?.finalPrompt
          ? { charCount: contextInput.finalPrompt.length }
          : { note: 'finalPrompt not stored in log' },
      },
      {
        step: 'Execution Done',
        status: log.success ? 'completed' : 'failed',
        elapsedMs: log.latencyMs,
        detail: { success: log.success, responseChars: log.responseChars },
      },
      {
        step: 'Telemetry Logged',
        status: 'completed',
        elapsedMs: log.latencyMs + 1,
        detail: { logId: log.id },
      },
    ]

    // ─── 3. 装配 Trace ───
    const trace: PromptTrace = {
      requestId: log.id,
      input: {
        raw: contextInput?.raw,
        contextHash: log.contextHash || undefined,
      },
      routing: {
        mode: log.routingMode,
        promptName: log.promptName,
        version: log.version,
        reason: log.routingMode === 'override' ? 'Manual override (debug/AB test)' : 'Deterministic routing',
      },
      execution: {
        finalPrompt: contextInput?.finalPrompt,
        variables: contextInput?.variables,
      },
      output: {
        text: contextInput?.outputText,
        success: log.success,
        latencyMs: log.latencyMs,
      },
      telemetry: {
        logId: log.id,
      },
      timeline,
      timestamp: log.createdAt.getTime(),
    }

    return trace
  } catch (err) {
    return { error: `Trace build failed: ${(err as Error).message}` }
  }
}

/**
 * 查询最近的 trace 列表（供前端展示 entry point）
 */
export async function listRecentTraces(limit = 20) {
  const logs = await prisma.promptRuntimeLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      promptName: true,
      version: true,
      routingMode: true,
      success: true,
      latencyMs: true,
      createdAt: true,
    },
  })

  return logs.map((log) => ({
    requestId: log.id,
    promptName: log.promptName,
    version: log.version,
    routingMode: log.routingMode,
    success: log.success,
    latencyMs: log.latencyMs,
    timestamp: log.createdAt.getTime(),
  }))
}
