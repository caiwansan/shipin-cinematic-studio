/**
 * services/p18/v3-worker-adapter.ts
 *
 * ═══════════════════════════════════════════════════════════════
 * V3 Worker Adapter — 在 production worker 中识别并路由 V3 任务
 *
 * 在现有的 video worker 处理流程中加入：
 *   检测 input._p18V3 === true →
 *     走 video-compiler（而不是 production-loop）
 *
 * 不需要修改现有 worker 逻辑。
 * 在 worker 处理函数的最顶层做路由分流即可。
 * ═══════════════════════════════════════════════════════════════
 */

import type { TaskPayload } from '../../queue/queue-manager.js'
import { compileVideo } from '../../services/video-compiler.js'
import { buildAndInjectShotIR } from '../../services/shotir-compiler.js'

/**
 * 判断一个任务是否是 V3 实验任务。
 */
export function isV3Task(payload: TaskPayload): boolean {
  return !!(payload.input?._p18V3)
}

/**
 * 执行 V3 实验管线的完整流程。
 *
 * 这是 V3 管线的 mini-orchestrator：
 *   1. 从 payload 提取 PromptIR
 *   2. buildAndInjectShotIR（ShotIR runtime compiler）
 *   3. compileVideo（确定性编译器）
 *   4. 输出保存到 v3_render_results 表
 */
export async function executeV3Pipeline(payload: TaskPayload): Promise<{
  success: boolean
  spec: any
  prompt: string
  traceId: string | null
  error?: string
}> {
  const { input, userId, taskId } = payload
  const promptIR = input?.promptIR
  const enablePolish = input?.enablePolish !== false
  const pairId = input?._p18PairId

  if (!promptIR) {
    // V3 标记但无 promptIR——记录失败
    if (pairId) {
      await recordV3Result({
        taskId: taskId || 'unknown',
        pairId,
        userId: userId || '',
        success: false,
        error: 'MISSING_PROMPTIR',
      })
    }
    return { success: false, spec: null, prompt: '', traceId: null, error: 'MISSING_PROMPTIR' }
  }

  try {
    // Step 1: ShotIR 编译（如果 shots 为空）
    const { promptIR: enriched, shotResult } = await buildAndInjectShotIR(promptIR, {
      enablePolish,
      userId,
    })

    // Step 2: 确定性编译
    const result = compileVideo(enriched)

    if (result.error) {
      await recordV3Result({
        taskId: taskId || 'unknown',
        pairId: pairId || '',
        userId: userId || '',
        success: false,
        error: result.error.message,
        stage: result.error.stage,
        code: result.error.code,
      })
      return {
        success: false,
        spec: null,
        prompt: '',
        traceId: result.trace?.traceId || null,
        error: result.error.message,
      }
    }

    // Step 3: 保存 V3 结果
    if (pairId) {
      await recordV3Result({
        taskId: taskId || 'unknown',
        pairId,
        userId: userId || '',
        success: true,
        spec: result.spec,
        prompt: result.prompt,
        scores: result.scores,
        traceId: result.trace?.traceId || null,
        shotCount: shotResult.shots.length,
        factGrid: shotResult.factGrid,
      })
    }

    return {
      success: true,
      spec: result.spec,
      prompt: result.prompt,
      traceId: result.trace?.traceId || null,
    }
  } catch (err: any) {
    const msg = err?.message || 'UNKNOWN_V3_ERROR'
    if (pairId) {
      await recordV3Result({
        taskId: taskId || 'unknown',
        pairId,
        userId: userId || '',
        success: false,
        error: msg,
      })
    }
    return { success: false, spec: null, prompt: '', traceId: null, error: msg }
  }
}

// ─── 结果持久化 ──────────────────────────────────────────────

interface V3ResultRecord {
  taskId: string
  pairId: string
  userId: string
  success: boolean
  error?: string
  stage?: string
  code?: string
  spec?: any
  prompt?: string
  scores?: any
  traceId?: string | null
  shotCount?: number
  factGrid?: any
}

async function recordV3Result(data: V3ResultRecord) {
  const { prisma } = await import('../../utils/index.js')
  try {
    await prisma.v3RenderResult.upsert({
      where: { taskId: data.taskId },
      update: {
        success: data.success,
        spec: data.spec ? JSON.parse(JSON.stringify(data.spec)) : null,
        prompt: data.prompt || null,
        traceId: data.traceId || null,
        error: data.error || null,
        stage: data.stage || null,
        code: data.code || null,
        completedAt: new Date(),
      },
      create: {
        taskId: data.taskId,
        pairId: data.pairId,
        userId: data.userId,
        success: data.success,
        spec: data.spec ? JSON.parse(JSON.stringify(data.spec)) : null,
        prompt: data.prompt || null,
        traceId: data.traceId || null,
        error: data.error || null,
        stage: data.stage || null,
        code: data.code || null,
        createdAt: new Date(),
      },
    })
  } catch (err) {
    console.warn(`[p18] ⚠️ V3 结果记录失败: ${(err as Error).message}`)
  }
}
