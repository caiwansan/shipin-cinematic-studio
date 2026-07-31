/**
 * services/director/decision-execution-adapter.service.ts
 *
 * DecisionExecutionAdapter — 导演决策执行适配器
 *
 * 职责：
 *   接收已确认的 DirectorDecisionContract
 *   根据 decisionType 映射到对应的 Task Runtime 调用
 *
 * 核心约束：
 *   ❌ 不绕过 Task Runtime — 所有任务通过 /api/tasks/ai-generate
 *   ❌ 不修改历史 Asset — 新 Task → 新 Asset
 *   ❌ 不创建新队列 / 新 Provider Adapter
 *   ❌ replace_asset 返回 NOT_IMPLEMENTED
 *
 * 数据流：
 *   User confirms decision
 *     ↓
 *   confirm API → executeDecision()
 *     ↓
 *   Task Runtime → BullMQ → Worker → Provider → New Asset
 *     ↓
 *   ExecutionTrace → TaskLog.metadata
 */

import type { DirectorDecisionContract, ExecutionTrace, DecisionType } from '../../types/director-decision-contract.js'
import { prisma } from '../../utils/index.js'

// ── 执行结果 ──

export interface DecisionExecutionResult {
  success: boolean
  decisionId: string
  decisionType: DecisionType
  action: 'none' | 'queued' | 'not_implemented' | 'failed'
  newTaskId?: string
  trace: ExecutionTrace
}

// ── Task Submitter 接口 ──

/**
 * 可替换的任务提交实现。
 * 生产环境通过 HTTP 调用 /api/tasks/ai-generate。
 */
export interface DecisionTaskSubmitter {
  submitGeneration(params: {
    projectId: string
    userId: string
    taskType: 'image' | 'tts' | 'video'
    prompt: string
    promptSource: string
    priority?: number
  }): Promise<{ taskId: string; error?: string }>
}

// ── 默认 Task Submitter ──

export function createDecisionTaskSubmitter(
  apiBase?: string,
  token?: string,
): DecisionTaskSubmitter {
  // 相对路径需要转为绝对 URL，使用本地服务地址
  const base = apiBase || 'http://localhost:4002'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return {
    async submitGeneration(params) {
      try {
        const res = await fetch(`${base}/api/tasks/ai-generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            projectId: params.projectId,
            taskType: params.taskType,
            input: {
              prompt: params.prompt,
              promptSource: params.promptSource,
            },
            priority: params.priority ?? 1,
          }),
        })
        const json = await res.json()
        if (!json.success) {
          return { taskId: '', error: json.error || 'task submission failed' }
        }
        return { taskId: json.task?.id || json.taskId || '' }
      } catch (e: any) {
        return { taskId: '', error: e.message }
      }
    },
  }
}

// ── 原任务数据接口 ──

/**
 * 从 VideoTask 获取原始执行数据
 * 用于 regenerate / modify_prompt 重建任务
 */
interface OriginalTaskData {
  projectId: string
  taskType: 'image' | 'tts' | 'video'
  prompt: string
  promptSource?: string
  metadata?: Record<string, any>
}

async function fetchOriginalTaskData(
  assetId: string,
): Promise<OriginalTaskData | null> {
  try {
    const task = await prisma.videoTask.findUnique({
      where: { id: assetId },
      select: {
        projectId: true,
        taskType: true,
      },
    })

    if (!task) return null

    return {
      projectId: task.projectId,
      taskType: task.taskType as 'image' | 'tts' | 'video',
      prompt: '', // prompt 由 production preparation 层管理，不存储在 VideoTask
      promptSource: 'director_decision',
    }
  } catch {
    return null
  }
}

// ── 核心执行函数 ──

/**
 * 执行已确认的导演决策
 *
 * @param decision 已确认的决策契约
 * @param confirmedBy 确认者用户 ID
 * @param submitter 任务提交器
 * @returns DecisionExecutionResult
 */
export async function executeDecision(
  decision: DirectorDecisionContract,
  confirmedBy: string,
  submitter: DecisionTaskSubmitter,
): Promise<DecisionExecutionResult> {
  const { id, decisionType, ownerId, assetId } = decision

  // ── keep：不执行 ──

  if (decisionType === 'keep') {
    const trace: ExecutionTrace = {
      decisionId: id,
      decisionType: 'keep',
      source: 'director_decision',
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      executionStatus: 'none',
    }

    await recordExecutionTrace(assetId, trace)

    return {
      success: true,
      decisionId: id,
      decisionType: 'keep',
      action: 'none',
      trace,
    }
  }

  // ── replace_asset：暂未实现 ──

  if (decisionType === 'replace_asset') {
    const trace: ExecutionTrace = {
      decisionId: id,
      decisionType: 'replace_asset',
      source: 'director_decision',
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      executionStatus: 'none',
    }

    await recordExecutionTrace(assetId, trace)

    return {
      success: false,
      decisionId: id,
      decisionType: 'replace_asset',
      action: 'not_implemented',
      trace,
    }
  }

  // ── regenerate / modify_prompt：读取原数据，创建新 Task ──

  const originalData = await fetchOriginalTaskData(assetId)

  if (!originalData) {
    const trace: ExecutionTrace = {
      decisionId: id,
      decisionType,
      source: 'director_decision',
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      executionStatus: 'failed',
      executionError: `找不到原任务数据 (assetId: ${assetId})`,
    }

    await recordExecutionTrace(assetId, trace)

    return {
      success: false,
      decisionId: id,
      decisionType,
      action: 'failed',
      trace,
    }
  }

  // modify_prompt: 在 prompt 前添加决策说明
  let finalPrompt = originalData.prompt
  if (decisionType === 'modify_prompt') {
    const decisionNote = `[AI导演建议修改] ${decision.reason}`
    finalPrompt = finalPrompt
      ? `${decisionNote}\n\n${finalPrompt}`
      : decisionNote
  }

  // 提交新任务
  const result = await submitter.submitGeneration({
    projectId: originalData.projectId,
    userId: confirmedBy,
    taskType: originalData.taskType,
    prompt: finalPrompt,
    promptSource: 'director_decision',
    priority: 1,
  })

  const trace: ExecutionTrace = {
    decisionId: id,
    decisionType,
    source: 'director_decision',
    confirmedBy,
    confirmedAt: new Date().toISOString(),
    generatedTaskId: result.taskId || undefined,
    executionStatus: result.error ? 'failed' : 'queued',
    executionError: result.error || undefined,
  }

  await recordExecutionTrace(assetId, trace)

  if (result.error) {
    return {
      success: false,
      decisionId: id,
      decisionType,
      action: 'failed',
      trace,
    }
  }

  return {
    success: true,
    decisionId: id,
    decisionType,
    action: 'queued',
    newTaskId: result.taskId,
    trace,
  }
}

// ── 记录执行痕迹 ──

async function recordExecutionTrace(
  assetId: string,
  trace: ExecutionTrace,
): Promise<void> {
  try {
    await prisma.taskLog.create({
      data: {
        taskId: assetId,
        level: 'info',
        message: `导演决策执行: ${trace.decisionType} → ${trace.executionStatus}`,
        metadata: {
          executionTrace: trace,
        },
      },
    })
  } catch {
    // TaskLog 写入失败不阻塞
  }
}
