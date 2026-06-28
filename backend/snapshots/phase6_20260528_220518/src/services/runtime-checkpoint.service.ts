/**
 * services/runtime-checkpoint.service.ts — BLOCKER-1 Runtime Checkpoint
 *
 * 关键设计原则：
 *   1. 不新增表，只在 Project 表加一个 runtimeCheckpoint Json 字段
 *   2. 结构化 schema，不是大 blob
 *   3. update-only 写入，不读取旧值（避免竞争）
 *   4. 前端刷新后通过 hydrate 恢复执行
 *
 * Schema:
 * ```json
 * {
 *   "version": 1,
 *   "lastUpdated": 1716000000000,
 *   "currentStage": "character | scene | storyboard | voice | frame | director",
 *   "completedStages": ["character", "scene"],
 *   "failedStages": [],
 *   "runningJobs": [
 *     { "stageKey": "character", "jobId": "uuid", "jobType": "image_generate", "status": "running" }
 *   ],
 *   "perStage": {
 *     "character": {
 *       "status": "completed",
 *       "completedJobs": 3,
 *       "totalJobs": 3,
 *       "error": null
 *     },
 *     "voice": {
 *       "status": "running",
 *       "completedJobs": 2,
 *       "totalJobs": 5,
 *       "error": null
 *     }
 *   }
 * }
 * ```
 */

import { prisma } from '../utils/index.js'

// ============ Types ============

export type CheckpointStageStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface StageCheckpoint {
  status: CheckpointStageStatus
  completedJobs: number
  totalJobs: number
  error: string | null
  startedAt?: number
  completedAt?: number
}

export interface RunningJob {
  stageKey: string
  jobId: string
  jobType: string
  status: string
}

export interface RuntimeCheckpoint {
  version: number
  lastUpdated: number
  currentStage: string | null
  completedStages: string[]
  failedStages: string[]
  runningJobs: RunningJob[]
  perStage: Record<string, StageCheckpoint>
}

// ============ Defaults ============

export function createEmptyCheckpoint(): RuntimeCheckpoint {
  return {
    version: 1,
    lastUpdated: Date.now(),
    currentStage: null,
    completedStages: [],
    failedStages: [],
    runningJobs: [],
    perStage: {},
  }
}

// ============ API ============

/**
 * 获取项目的 runtime checkpoint
 */
export async function getCheckpoint(projectId: string): Promise<RuntimeCheckpoint | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { runtimeCheckpoint: true },
  })
  return (project?.runtimeCheckpoint as RuntimeCheckpoint) || null
}

/**
 * 保存 checkpoint（全量替换，只写不读）
 */
export async function saveCheckpoint(
  projectId: string,
  checkpoint: RuntimeCheckpoint,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { runtimeCheckpoint: checkpoint as any },
  })
}

/**
 * 更新某个 stage 的状态（只更新 perStage 部分，不覆盖其他）
 */
export async function updateStageCheckpoint(
  projectId: string,
  stageKey: string,
  update: Partial<StageCheckpoint>,
): Promise<RuntimeCheckpoint | null> {
  const checkpoint = await getCheckpoint(projectId)
  if (!checkpoint) return null

  checkpoint.perStage[stageKey] = {
    ...(checkpoint.perStage[stageKey] || {
      status: 'pending',
      completedJobs: 0,
      totalJobs: 0,
      error: null,
    }),
    ...update,
  }
  checkpoint.lastUpdated = Date.now()

  await saveCheckpoint(projectId, checkpoint)
  return checkpoint
}

/**
 * 标记某个 stage 为 completed（自动从 failedStages 移除）
 */
export async function completeStage(
  projectId: string,
  stageKey: string,
): Promise<RuntimeCheckpoint | null> {
  const checkpoint = await getCheckpoint(projectId)
  if (!checkpoint) return null

  checkpoint.perStage[stageKey] = {
    status: 'completed',
    completedJobs: 0,
    totalJobs: 0,
    error: null,
    completedAt: Date.now(),
  }
  if (!checkpoint.completedStages.includes(stageKey)) {
    checkpoint.completedStages.push(stageKey)
  }
  checkpoint.failedStages = checkpoint.failedStages.filter(s => s !== stageKey)
  checkpoint.lastUpdated = Date.now()

  await saveCheckpoint(projectId, checkpoint)
  return checkpoint
}

/**
 * 标记某个 stage 为 failed
 */
export async function failStage(
  projectId: string,
  stageKey: string,
  error: string,
): Promise<RuntimeCheckpoint | null> {
  const checkpoint = await getCheckpoint(projectId)
  if (!checkpoint) return null

  checkpoint.perStage[stageKey] = {
    ...(checkpoint.perStage[stageKey] || {
      status: 'pending',
      completedJobs: 0,
      totalJobs: 0,
      error: null,
    }),
    status: 'failed',
    error,
  }
  if (!checkpoint.failedStages.includes(stageKey)) {
    checkpoint.failedStages.push(stageKey)
  }
  checkpoint.lastUpdated = Date.now()

  await saveCheckpoint(projectId, checkpoint)
  return checkpoint
}

/**
 * 设置当前正在执行的 stage
 */
export async function setCurrentStage(
  projectId: string,
  stageKey: string,
): Promise<RuntimeCheckpoint | null> {
  const checkpoint = await getCheckpoint(projectId)
  if (!checkpoint) return null

  checkpoint.currentStage = stageKey
  checkpoint.perStage[stageKey] = {
    ...(checkpoint.perStage[stageKey] || {
      status: 'pending',
      completedJobs: 0,
      totalJobs: 0,
      error: null,
    }),
    status: 'running',
    startedAt: Date.now(),
  }
  checkpoint.lastUpdated = Date.now()

  await saveCheckpoint(projectId, checkpoint)
  return checkpoint
}

/**
 * 初始化 checkpoint（如果不存在）
 */
export async function initCheckpoint(
  projectId: string,
  stages: string[],
): Promise<RuntimeCheckpoint> {
  const existing = await getCheckpoint(projectId)
  if (existing) return existing

  const checkpoint = createEmptyCheckpoint()
  for (const stage of stages) {
    checkpoint.perStage[stage] = {
      status: 'pending',
      completedJobs: 0,
      totalJobs: 0,
      error: null,
    }
  }

  await saveCheckpoint(projectId, checkpoint)
  return checkpoint
}

/**
 * 判断是否可以恢复执行
 */
export function canResume(checkpoint: RuntimeCheckpoint | null): boolean {
  if (!checkpoint) return false
  if (checkpoint.currentStage === null) return false
  if (checkpoint.failedStages.length > 0) return true  // 可以重试失败的 stage
  if (checkpoint.runningJobs.length > 0) return true    // 有未完成的 job
  return !!checkpoint.currentStage                       // 中途刷新
}

/**
 * 获取 resume 所需的信息
 */
export function getResumeInfo(checkpoint: RuntimeCheckpoint | null): {
  canResume: boolean
  resumeStage: string | null
  failedStages: string[]
  runningJobs: RunningJob[]
  completedStages: string[]
  message: string
} {
  if (!checkpoint) {
    return { canResume: false, resumeStage: null, failedStages: [], runningJobs: [], completedStages: [], message: 'no_checkpoint' }
  }

  const resumeStage = checkpoint.failedStages[0] || checkpoint.currentStage

  if (checkpoint.failedStages.length > 0) {
    return {
      canResume: true,
      resumeStage,
      failedStages: checkpoint.failedStages,
      runningJobs: checkpoint.runningJobs,
      completedStages: checkpoint.completedStages,
      message: `stage ${resumeStage} 失败，可重试`,
    }
  }

  if (checkpoint.runningJobs.length > 0) {
    return {
      canResume: true,
      resumeStage,
      failedStages: [],
      runningJobs: checkpoint.runningJobs,
      completedStages: checkpoint.completedStages,
      message: `${checkpoint.runningJobs.length} 个 job 未完成`,
    }
  }

  if (checkpoint.currentStage) {
    return {
      canResume: true,
      resumeStage,
      failedStages: [],
      runningJobs: [],
      completedStages: checkpoint.completedStages,
      message: `从 stage "${resumeStage}" 继续`,
    }
  }

  return {
    canResume: false,
    resumeStage: null,
    failedStages: [],
    runningJobs: [],
    completedStages: checkpoint.completedStages,
    message: 'no_resume_needed',
  }
}
