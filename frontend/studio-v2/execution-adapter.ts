/**
 * ExecutionAdapter — Legacy 到 Platform Execution 的兼容层
 *
 * 职责：将旧式 `{ taskType, input }` 调用映射为新 execution 接口
 * 设计：Adapter 模式 + FeatureFlag 控制（不影响生产）
 *
 * 使用方法：
 *   执行适配层不改变 api.ts 的接口签名。
 *   接入后调用方无需修改代码——api.tasks.generate(data) 仍然可用。
 *   Adapter 决定走新路径还是旧路径。
 */

import type { CapabilityContractInput } from '@platform/execution/types'

// ─── TaskType → CapabilityId ────────────────────────────

const TASK_TYPE_MAP: Record<string, { capabilityId: string }> = {
  image: { capabilityId: 'image-generation' },
  video: { capabilityId: 'video-generation' },
  tts:   { capabilityId: 'tts-generation' },
  frame: { capabilityId: 'frame-generation' },
}

// ─── Legacy Response Shape ──────────────────────────────

interface LegacyTaskResponse {
  success: boolean
  task: {
    id: string
    projectId: string
    taskType: string
    status: string
    priority: number
    result?: Record<string, any>
    error?: string
  }
}

// ─── Execution Response Shape（平台新接口） ─────────────────

interface ExecutionResponse {
  success: boolean
  data?: {
    planId: string
    status: string
    finalOutput?: any
    stepResults: any[]
    error?: { code: string; message: string }
  }
  error?: string
}

// ─── FeatureFlag ────────────────────────────────────────

const USE_EXECUTION_API = false // ← 默认 false。灰度时改为 true

// ─── Legacy Contract 生成（从旧 taskType + input） ───────

function legacyInputToContract(taskType: string, input: any): CapabilityContractInput | null {
  const mapping = TASK_TYPE_MAP[taskType]
  if (!mapping) return null

  return {
    id: `contract-${Date.now()}`,
    name: `${taskType}-generation`,
    displayName: `${taskType} Generation`,
    description: null,
    category: taskType,
    version: '1.0',
    status: 'active',
    metadata: { source: 'legacy-adapter' },
  }
}

// ─── Legacy 到新响应的转换 ───────────────────────────────

function executionResponseToLegacy(execRes: ExecutionResponse, taskType: string): LegacyTaskResponse {
  if (!execRes.success || !execRes.data) {
    return {
      success: false,
      task: {
        id: '',
        projectId: '',
        taskType,
        status: 'failed',
        priority: 1,
        error: execRes.error || execRes.data?.error?.message || '未知错误',
      },
    }
  }

  return {
    success: true,
    task: {
      id: execRes.data.planId,
      projectId: '',
      taskType,
      status: execRes.data.status === 'completed' ? 'completed' : 'running',
      priority: 1,
      result: execRes.data.finalOutput,
    },
  }
}

// ─── Legacy 状态查询到新响应的转换 ────────────────────────

function executionStatusToLegacyStatus(platformStatus: string): string {
  const map: Record<string, string> = {
    pending: 'queued',
    running: 'processing',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
  }
  return map[platformStatus] || platformStatus
}

// ─── 导出的 Adapter 函数 ────────────────────────────────

/**
 * 执行 AI 生成任务（通过新平台或 Legacy 队列）
 * @param taskType 任务类型：'image' | 'video' | 'tts' | 'frame'
 * @param input 任务负载
 * @param apiKey 用户 API Key（由上游传入，不读 process.env）
 */
export async function executeTask(
  taskType: string,
  input: Record<string, any>,
  projectId?: string,
): Promise<LegacyTaskResponse> {
  const baseUrl = (window as any).__API_BASE__ || '/api'

  if (USE_EXECUTION_API) {
    const contract = legacyInputToContract(taskType, input)
    if (!contract) {
      return {
        success: false,
        task: {
          id: '',
          projectId: projectId || '',
          taskType,
          status: 'failed',
          priority: 1,
          error: `不支持的 taskType: ${taskType}`,
        },
      }
    }

    try {
      const res = await fetch(`${baseUrl}/platform/execution/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityId: TASK_TYPE_MAP[taskType].capabilityId,
          contract,
          input: { ...input, projectId },
          strategy: 'sequential',
        }),
      })
      const data: ExecutionResponse = await res.json()
      return executionResponseToLegacy(data, taskType)
    } catch (err: any) {
      return {
        success: false,
        task: {
          id: '',
          projectId: projectId || '',
          taskType,
          status: 'failed',
          priority: 1,
          error: err.message || '网络错误',
        },
      }
    }
  }

  // Legacy 路径：走老路由
  const res = await fetch(`${baseUrl}/tasks/ai-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, taskType, input }),
  })
  return res.json()
}

/**
 * 查询任务状态
 */
export async function executeTaskStatus(taskId: string): Promise<{ success: boolean; task: any }> {
  const baseUrl = (window as any).__API_BASE__ || '/api'

  if (USE_EXECUTION_API) {
    try {
      const res = await fetch(`${baseUrl}/platform/execution/result?planId=${taskId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      const data: ExecutionResponse = await res.json()
      if (!data.success || !data.data) {
        return { success: false, task: { id: taskId, status: 'failed' } }
      }
      return {
        success: true,
        task: {
          id: taskId,
          status: executionStatusToLegacyStatus(data.data.status),
          result: data.data.finalOutput,
        },
      }
    } catch {
      return { success: false, task: { id: taskId, status: 'failed' } }
    }
  }

  // Legacy 路径
  const res = await fetch(`${baseUrl}/tasks/${taskId}/status`)
  return res.json()
}
