/**
 * session-registry.ts — Phase 6C.3: Session Isolation Model
 *
 * 核心思想：
 *   每个 session 是独立的状态宇宙（"session is a universe, not a record"）
 *   runtime 层面的全局单例改为 session-scoped 实例
 *
 * 隔离范围：
 *   - constitution (投影后不可变)
 *   - drift graph (独立演化)
 *   - energy state (独立计算)
 *   - intent vector (独立方向)
 *   - intervention history (独立记录)
 *
 * 允许的跨 session 交互：
 *   仅 aggregate statistics（global drift distribution / energy histogram）
 */

import { DirectorError, isDirectorError, Errors } from './director-error.js'
import type { StoryConstitution } from '../schema/story-constitution.js'
import type { ProjectionState } from './director-projection.js'

// ============================================================
// Types
// ============================================================

export interface SessionState {
  sessionId: string

  /** 投影后的 constitution（immutable after generation） */
  constitution: StoryConstitution | null
  /** = 原始 constitution (pre-projection) */
  rawConstitution: StoryConstitution | null

  /** 漂移图 state */
  driftState: SessionDriftState
  /** 能量 state */
  energyState: SessionEnergyState
  /** 意图向量 */
  intentVector: SessionIntentVector
  /** 干预历史 */
  interventions: SessionIntervention[]

  /** 元数据 */
  createdAt: number
  updatedAt: number
  lastAccess: number
  totalRuns: number
}

export interface SessionDriftState {
  snapshots: { run: number; overall: number; dimensions: Record<string, number>; timestamp: number }[]
  dimensions: Record<string, {
    snapshots: { run: number; delta: number; score: number; timestamp: number }[]
    velocity: number
    acceleration: number
  }>
}

export interface SessionEnergyState {
  current: number
  history: { timestamp: number; value: number }[]
  peak: number
  valley: number
  lastUpdate: number
}

export interface SessionIntentVector {
  genre: string[]
  primaryMood: string
  pacingPreference: 'slow' | 'moderate' | 'fast'
  intensityTarget: number
  visualStyle: string[]
}

export interface SessionIntervention {
  run: number
  strategy: string
  reason: string
  timestamp: number
  success: boolean
}

// ============================================================
// Session Registry
// ============================================================

export class SessionRegistry {
  private sessions: Map<string, SessionState> = new Map()
  private maxSessions: number

  constructor(maxSessions: number = 100) {
    this.maxSessions = maxSessions
  }

  /**
   * 创建新 session
   * 如果达到上限，驱逐最老的 stale session
   */
  createSession(sessionId: string): SessionState | DirectorError {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!
    }

    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest()
    }

    const now = Date.now()
    const state: SessionState = {
      sessionId,
      constitution: null,
      rawConstitution: null,
      driftState: { snapshots: [], dimensions: {} },
      energyState: { current: 0.5, history: [], peak: 0.5, valley: 0.5, lastUpdate: now },
      intentVector: {
        genre: [], primaryMood: 'neutral', pacingPreference: 'moderate',
        intensityTarget: 0.5, visualStyle: [],
      },
      interventions: [],
      createdAt: now,
      updatedAt: now,
      lastAccess: now,
      totalRuns: 0,
    }

    this.sessions.set(sessionId, state)
    return state
  }

  /**
   * 获取 session 状态（同时记录最后访问时间）
   */
  getSession(sessionId: string): SessionState | DirectorError {
    const state = this.sessions.get(sessionId)
    if (!state) {
      return Errors.sessionNotFound(sessionId)
    }
    state.lastAccess = Date.now()
    return state
  }

  /**
   * 更新 session 状态（unsafe — 外部必须确保在正确的 session 上操作）
   */
  updateSession(sessionId: string, patch: Partial<SessionState>): SessionState | DirectorError {
    const state = this.sessions.get(sessionId)
    if (!state) return Errors.sessionNotFound(sessionId)

    // 不允许跨 session 写 — 但代码层面保证已在 registry 内
    const updated: SessionState = {
      ...state,
      ...patch,
      sessionId, // never change sessionId
      updatedAt: Date.now(),
    }
    this.sessions.set(sessionId, updated)
    return updated
  }

  /**
   * 销毁 session（完全清除状态）
   */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  /**
   * 获取 session 快照（只读摘要，不含敏感细节）
   */
  snapshotSession(sessionId: string): SessionSnapshot | DirectorError {
    const state = this.sessions.get(sessionId)
    if (!state) return Errors.sessionNotFound(sessionId)

    return {
      sessionId,
      constitutionHash: state.constitution ? this.hash(JSON.stringify(state.constitution)) : null,
      driftSummary: {
        snapshotCount: state.driftState.snapshots.length,
        dimensionCount: Object.keys(state.driftState.dimensions).length,
        latestScore: state.driftState.snapshots[state.driftState.snapshots.length - 1]?.overall ?? null,
      },
      energySummary: {
        current: state.energyState.current,
        peak: state.energyState.peak,
        valley: state.energyState.valley,
      },
      intentSummary: { ...state.intentVector },
      interventionCount: state.interventions.length,
      totalRuns: state.totalRuns,
      createdAt: state.createdAt,
      lastAccess: state.lastAccess,
    }
  }

  /**
   * List active sessions
   */
  listActiveSessions(): SessionSummary[] {
    const now = Date.now()
    return Array.from(this.sessions.values()).map(s => ({
      sessionId: s.sessionId,
      runs: s.totalRuns,
      interventions: s.interventions.length,
      driftScore: s.driftState.snapshots[s.driftState.snapshots.length - 1]?.overall ?? null,
      constitutionPresent: s.constitution !== null,
      age: now - s.createdAt,
      idleTime: now - s.lastAccess,
    }))
  }

  /**
   * 全局 aggregate metrics（仅允许的跨 session 交互）
   */
  getGlobalMetrics(): GlobalSessionMetrics {
    const sessions = Array.from(this.sessions.values())
    const now = Date.now()

    const driftScores = sessions
      .map(s => s.driftState.snapshots[s.driftState.snapshots.length - 1]?.overall)
      .filter((s): s is number => s !== undefined)

    const energyLevels = sessions.map(s => s.energyState.current)
    const interventionCounts = sessions.map(s => s.interventions.length)

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => now - s.lastAccess < 3600000).length, // < 1h active
      driftDistribution: driftScores,
      avgDrift: driftScores.length > 0 ? driftScores.reduce((a, b) => a + b, 0) / driftScores.length : 0,
      energyHistogram: energyLevels,
      avgEnergy: energyLevels.length > 0 ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length : 0,
      interventionRates: interventionCounts,
      totalInterventions: interventionCounts.reduce((a, b) => a + b, 0),
    }
  }

  /**
   * Session 是否存在
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * 当前 session 数
   */
  get size(): number {
    return this.sessions.size
  }

  // ============================================================
  // Internal
  // ============================================================

  private hash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 驱逐最老的 idle session
   */
  private evictOldest(): void {
    let oldestId: string | null = null
    let oldestAccess = Infinity

    for (const [id, state] of this.sessions) {
      if (state.lastAccess < oldestAccess) {
        oldestAccess = state.lastAccess
        oldestId = id
      }
    }

    if (oldestId) {
      this.sessions.delete(oldestId)
    }
  }
}

// ============================================================
// Interface types
// ============================================================

export interface SessionSnapshot {
  sessionId: string
  constitutionHash: string | null
  driftSummary: {
    snapshotCount: number
    dimensionCount: number
    latestScore: number | null
  }
  energySummary: {
    current: number
    peak: number
    valley: number
  }
  intentSummary: SessionIntentVector
  interventionCount: number
  totalRuns: number
  createdAt: number
  lastAccess: number
}

export interface SessionSummary {
  sessionId: string
  runs: number
  interventions: number
  driftScore: number | null
  constitutionPresent: boolean
  age: number
  idleTime: number
}

export interface GlobalSessionMetrics {
  totalSessions: number
  activeSessions: number
  driftDistribution: number[]
  avgDrift: number
  energyHistogram: number[]
  avgEnergy: number
  interventionRates: number[]
  totalInterventions: number
}

/** 全局单例 */
export const sessionRegistry = new SessionRegistry()
