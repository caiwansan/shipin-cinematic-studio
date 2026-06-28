/**
 * services/p18/dual-render-orchestrator.ts
 *
 * ═══════════════════════════════════════════════════════════════
 * P1.8 Data Activation Layer — Dual Render Orchestrator
 *
 * 核心逻辑：
 *   每 script submit → 同时触发 V2（production） + V3（experiment）
 *   两条管线完全独立、互不污染
 *   V2 始终是 baseline truth（不变）
 *   V3 始终保持实验特性（不退化）
 *   输出成对样本写入 p18_pairs 表
 * ═══════════════════════════════════════════════════════════════
 */

import { prisma } from '../../utils/index.js'
import { enqueueTask } from '../../queue/queue-manager.js'
import type { RuntimePayload } from '../../runtime/runtime-payload.js'

// ─── 类型 ────────────────────────────────────────────────────

export interface DualRenderInput {
  projectId: string
  userId: string
  scriptContent: string
  /** V2 管线所需的原始输入（与原 POST /api/tasks/ai-generate 一致） */
  v2Input: Record<string, any>
  /** V3 管线所需的 PromptIR（与原 POST /api/video-optimize 一致） */
  v3PromptIR: Record<string, any>
  enableV3Polish?: boolean
  priority?: number
}

export interface DualRenderResult {
  pairId: string
  scriptId: string
  v2: {
    taskId: string
    traceId: string
    status: 'queued' | 'running' | 'failed'
  }
  v3: {
    taskId: string
    traceId: string
    status: 'queued' | 'running' | 'failed'
  }
  linked: true
}

// ─── P1.8 宪法 ──────────────────────────────────────────────

/**
 * ❌ 禁止：
 *    1. 只生成 V3 不生成 V2
 *    2. V3 回退到 V2 pipeline
 *    3. 补录 V2（必须同源同时生成）
 *    4. 修改 V2 管线行为
 *
 * 🛡️ Activation Guarantee（数据激活保障）：
 *    任何经过生产路径的 script 执行，
 *    必须至少在 dual-render 中路由一次。
 *    系统不会自然等待——必须保证现实必然被接入。
 *
 *    形式化：
 *      P(dual-render ≥ 1) ≠ automatic
 *      P(dual-render ≥ 1) = depends on system usage path
 *      → 必须由上游主动调用 dual-render，而非被动等数据流入。
 */

// ─── 核心 ────────────────────────────────────────────────────

/**
 * 调度一次双轨渲染。
 * 对一个 script 同时提交 V2（production） 和 V3（experiment） 两条任务。
 */
export async function scheduleDualRender(
  input: DualRenderInput,
  runtime: RuntimePayload,
): Promise<DualRenderResult> {
  const {
    projectId, userId, v2Input, v3PromptIR,
    enableV3Polish = true, priority = 1,
  } = input

  // 生成配对 ID（用于关联两条生产链的输出）
  const pairId = `pair_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`

  // ── V2 管线（production） ────────────────────────────────────
  // 保持与原 POST /api/tasks/ai-generate 完全一致的行为
  const v2TraceId = await enqueueTask({
    taskType: 'video',
    projectId,
    userId,
    input: v2Input,
    priority,
    // 不传递任何 V3 相关内容——V2 必须是 pure baseline
  })

  // ── V3 管线（experiment） ────────────────────────────────────
  // 通过单独的 taskType 或 input flag 区分
  // 使用同一個 runtime（相同的 BYOK 配置）
  const v3TraceId = await enqueueTask({
    taskType: 'video',
    projectId,
    userId,
    input: {
      // V3 标记——Worker 识别后走 video-compiler 而非 production-loop
      _p18V3: true,
      _p18PairId: pairId,
      promptIR: v3PromptIR,
      enablePolish: enableV3Polish,
      // 原始任务信息（用于回放/审计）
      _sourceTaskType: 'p18-dual-render',
    },
    priority: Math.max(1, priority - 1), // V3 实验任务优先级略低于 production
    runtime,
  })

  // ── 记录配对关系 ────────────────────────────────────────────
  // 写入 p18_pairs 表，供后续评估采集
  try {
    await prisma.p18Pair.create({
      data: {
        pairId,
        projectId,
        userId,
        scriptContent: input.scriptContent,
        v2TaskId: v2TraceId,
        v3TaskId: v3TraceId,
        status: 'pending',
        createdAt: new Date(),
      },
    })
  } catch (err) {
    // 配对记录写入失败不应阻塞渲染任务
    console.warn(`[p18] ⚠️ 配对记录写入失败: ${(err as Error).message}`)
  }

  return {
    pairId,
    scriptId: projectId,
    v2: { taskId: v2TraceId, traceId: v2TraceId, status: 'queued' },
    v3: { taskId: v3TraceId, traceId: v3TraceId, status: 'queued' },
    linked: true,
  }
}

/**
 * 查询一对双轨渲染的结果。
 */
export async function getDualRenderResult(pairId: string) {
  const pair = await prisma.p18Pair.findUnique({
    where: { pairId },
  })

  if (!pair) return null

  // 查询 V2 任务状态
  const v2Task = await prisma.videoTask.findUnique({
    where: { id: pair.v2TaskId },
  })

  // 查询 V3 任务状态（也可能存储在同一个表或不同的结果区）
  const v3Result = await prisma.v3RenderResult.findUnique({
    where: { taskId: pair.v3TaskId },
  })

  return {
    pair,
    v2: v2Task,
    v3: v3Result,
  }
}
