/**
 * services/execution-journal.service.ts — Phase B: Execution Journal Runtime
 *
 * Append-only 执行日志层。每个阶段的关键操作产生一个 journal event。
 * 刷新时可通过 replayEvents() 恢复 runtime 状态。
 *
 * 设计原则：
 * 1. 只 append，不 update，不 delete（审计性）
 * 2. event 按 projectId 分组，sequence 递增
 * 3. replayEvents() 将 events 推入 reducer 重建当前 runtime state
 * 4. 写入失败静默忽略（不干扰主流程）
 *
 * Event 类型（按 stage 分）：
 *   CHARACTER_GENERATED
 *   CHARACTER_IMAGE_GENERATED
 *   SCENE_GENERATED
 *   SCENE_IMAGE_GENERATED
 *   VOICE_CONFIGURED
 *   STORYBOARD_GENERATED
 *   VIDEO_RENDER_STARTED
 *   VIDEO_RENDER_COMPLETED
 *   PIPELINE_STAGE_COMMITTED
 *   CHECKPOINT_CREATED
 *   FAILURE_RECOVERED
 *   USER_EDITED
 */

import { prisma } from '../utils/index.js'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export type JournalEventType =
  | 'CHARACTER_GENERATED'
  | 'CHARACTER_IMAGE_GENERATED'
  | 'SCENE_GENERATED'
  | 'SCENE_IMAGE_GENERATED'
  | 'VOICE_CONFIGURED'
  | 'STORYBOARD_GENERATED'
  | 'VIDEO_RENDER_STARTED'
  | 'VIDEO_RENDER_COMPLETED'
  | 'PIPELINE_STAGE_COMMITTED'
  | 'CHECKPOINT_CREATED'
  | 'FAILURE_RECOVERED'
  | 'USER_EDITED'
  | 'RUNTIME_RESUMED'

export interface JournalEvent {
  type: JournalEventType
  stage: string
  timestamp: number
  sequence: number
  executionId: string
  userId?: string
  trigger: 'ai' | 'user' | 'system' | 'worker'
  payload: Record<string, any>
  /** Optional checksum of the data at this point */
  checksum?: string
  /** Previous event sequence (for chain validation) */
  previousSequence?: number
}

// ═══════════════════════════════════════════════════
// Event Storage
// ═══════════════════════════════════════════════════

/**
 * 追加 journal event。写入失败静默忽略。
 */
export async function appendEvent(event: Omit<JournalEvent, 'sequence'>): Promise<void> {
  try {
    const existing = await prisma.project.findUnique({
      where: { id: event.executionId },
      select: { executionJournal: true },
    })
    if (!existing) return

    const events: JournalEvent[] = existing.executionJournal && Array.isArray(existing.executionJournal)
      ? (existing.executionJournal as JournalEvent[])
      : []
    const lastSequence = events.length > 0 ? events[events.length - 1].sequence : 0

    const fullEvent: JournalEvent = {
      ...event,
      sequence: lastSequence + 1,
      previousSequence: lastSequence > 0 ? lastSequence : undefined,
    }

    events.push(fullEvent)

    await prisma.project.update({
      where: { id: event.executionId },
      data: { executionJournal: events as any },
    })
  } catch (err) {
    // 静默：journal 不能阻塞执行
    console.warn('[ExecutionJournal] appendEvent failed:', (err as Error).message)
  }
}

/**
 * 批量追加 events（原子写入，避免多次 DB 查询）
 */
export async function appendEvents(projectId: string, newEvents: Omit<JournalEvent, 'sequence'>[]): Promise<void> {
  try {
    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { executionJournal: true },
    })
    if (!existing) return

    const events: JournalEvent[] = existing.executionJournal && Array.isArray(existing.executionJournal)
      ? (existing.executionJournal as JournalEvent[])
      : []
    let lastSequence = events.length > 0 ? events[events.length - 1].sequence : 0

    for (const event of newEvents) {
      lastSequence++
      events.push({
        ...event,
        sequence: lastSequence,
        previousSequence: lastSequence > 1 ? lastSequence - 1 : undefined,
      })
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { executionJournal: events as any },
    })
  } catch (err) {
    console.warn('[ExecutionJournal] appendEvents failed:', (err as Error).message)
  }
}

/**
 * 读取项目的所有 journal events
 */
export async function getEvents(projectId: string): Promise<JournalEvent[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { executionJournal: true },
    })
    return Array.isArray(project?.executionJournal) ? (project?.executionJournal as JournalEvent[]) : []
  } catch {
    return []
  }
}

/**
 * 读取最后 N 条 events
 */
export async function getRecentEvents(projectId: string, limit: number = 20): Promise<JournalEvent[]> {
  const events = await getEvents(projectId)
  return events.slice(-limit)
}

// ═══════════════════════════════════════════════════
// Runtime Reducer
// ═══════════════════════════════════════════════════

export interface ExecutionRuntimeState {
  stage: string | null
  characterSpecs: any[] | null
  sceneSpecs: any[] | null
  voiceConfigs: any[] | null
  videoSegments: any[] | null
  videoProduction: any | null
  completedStages: Set<string>
  currentStage: string | null
  lastEventTimestamp: number | null
  lastEventSequence: number | null
  executionId: string | null
}

export function createEmptyRuntimeState(): ExecutionRuntimeState {
  return {
    stage: null,
    characterSpecs: null,
    sceneSpecs: null,
    voiceConfigs: null,
    videoSegments: null,
    videoProduction: null,
    completedStages: new Set(),
    currentStage: null,
    lastEventTimestamp: null,
    lastEventSequence: null,
    executionId: null,
  }
}

/**
 * reducer: JournalEvent → ExecutionRuntimeState
 * 纯函数，无副作用。
 */
export function reduceEvent(state: ExecutionRuntimeState, event: JournalEvent): ExecutionRuntimeState {
  const next = { ...state }
  next.lastEventTimestamp = event.timestamp
  next.lastEventSequence = event.sequence
  next.executionId = event.executionId

  switch (event.type) {
    case 'CHARACTER_GENERATED':
      next.characterSpecs = event.payload.characterSpecs || next.characterSpecs
      next.stage = 'character'
      break

    case 'SCENE_GENERATED':
      next.sceneSpecs = event.payload.sceneSpecs || next.sceneSpecs
      next.stage = 'scene'
      break

    case 'VOICE_CONFIGURED':
      next.voiceConfigs = event.payload.voiceConfigs || next.voiceConfigs
      next.stage = 'voice'
      break

    case 'STORYBOARD_GENERATED':
      next.videoSegments = event.payload.videoSegments || next.videoSegments
      next.stage = 'storyboard'
      break

    case 'VIDEO_RENDER_COMPLETED':
      next.videoProduction = event.payload.videoProduction || next.videoProduction
      next.stage = 'video'
      break

    case 'PIPELINE_STAGE_COMMITTED':
      if (event.payload.stage) {
        next.completedStages.add(event.payload.stage)
      }
      break

    case 'RUNTIME_RESUMED':
      // Resume event carries full snapshot
      if (event.payload.state) {
        const snap = event.payload.state
        if (snap.characterSpecs) next.characterSpecs = snap.characterSpecs
        if (snap.sceneSpecs) next.sceneSpecs = snap.sceneSpecs
        if (snap.voiceConfigs) next.voiceConfigs = snap.voiceConfigs
        if (snap.videoSegments) next.videoSegments = snap.videoSegments
        if (snap.videoProduction) next.videoProduction = snap.videoProduction
        if (snap.completedStages) next.completedStages = new Set(snap.completedStages)
      }
      break

    case 'FAILURE_RECOVERED':
      if (event.payload.recoveredStage) {
        next.completedStages.add(event.payload.recoveredStage)
      }
      break
  }

  return next
}

/**
 * Replay: events → runtime state
 * 纯函数，适合在页面加载时调用。
 */
export function replayEvents(events: JournalEvent[]): ExecutionRuntimeState {
  return events.reduce((state, event) => reduceEvent(state, event), createEmptyRuntimeState())
}

/**
 * 从 DB 加载 journal 并 replay 为 runtime state
 */
export async function loadAndReplay(projectId: string): Promise<ExecutionRuntimeState> {
  const events = await getEvents(projectId)
  return replayEvents(events)
}

// ═══════════════════════════════════════════════════
// Stage Commit Barrier
// ═══════════════════════════════════════════════════

/**
 * 阶段性提交屏障（Stage Commit Barrier）
 *
 * 在阶段切换时调用，确保：
 * 1. 所有 pending writes 完成
 * 2. journal event 已追加
 * 3. DB 读取验证（double-check confirm）
 *
 * 返回成功/失败 + 最终 execution_results
 */
export async function commitStage(
  projectId: string,
  stage: string,
  eventType: JournalEventType,
  data: Record<string, any>,
  options?: {
    flushWait?: number    // ms to wait for pending writes (default 100)
    verifyRead?: boolean  // read back and verify (default true)
    timeout?: number      // total timeout (default 5000)
  }
): Promise<{ success: boolean; error?: string }> {
  const flushWait = options?.flushWait ?? 100
  const verifyRead = options?.verifyRead ?? true
  const timeout = options?.timeout ?? 5000

  try {
    // 1. Wait for pending writes to settle
    if (flushWait > 0) {
      await new Promise(r => setTimeout(r, flushWait))
    }

    // 2. Append journal event
    await appendEvent({
      type: eventType,
      stage,
      timestamp: Date.now(),
      executionId: projectId,
      trigger: 'system',
      payload: data,
    })

    // Also save the data to execution_results for backward compatibility
    // (journal is the source of truth, execution_results is the snapshot)
    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { executionResults: true, executionJournal: true },
    })
    if (existing) {
      const currentResults = (existing.executionResults as Record<string, any>) || {}
      const merged = { ...currentResults, ...data }
      await prisma.project.update({
        where: { id: projectId },
        data: { executionResults: merged as any },
      })
    }

    // 3. Verify with readers (read back and confirm)
    if (verifyRead) {
      const verifyTimer = setTimeout(() => {
        throw new Error(`commitStage: verify timeout for ${stage}`)
      }, timeout)

      let verified = false
      let attempts = 0
      while (!verified && attempts < 5) {
        const reRead = await prisma.project.findUnique({
          where: { id: projectId },
          select: { executionResults: true, executionJournal: true },
        })

        if (reRead?.executionJournal) {
          const journal = reRead.executionJournal as any[]
          const lastEvent = journal[journal.length - 1]
          if (lastEvent && lastEvent.sequence === (Array.isArray(reRead.executionJournal) ? reRead.executionJournal.length : 0)) {
            verified = true
            break
          }
        }

        attempts++
        await new Promise(r => setTimeout(r, 200))
      }

      clearTimeout(verifyTimer)
      if (!verified) {
        throw new Error(`commitStage: verify failed after ${attempts} attempts`)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[ExecutionJournal] commitStage(${stage}) failed:`, err.message)
    return { success: false, error: err.message }
  }
}
