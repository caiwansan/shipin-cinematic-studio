/**
 * Worker Memory — Working Memory for Showrunner Worker v2
 *
 * 为每一步执行提供状态记录和上下文：
 * - 每步的输入/输出/反思/修正记录
 * - 全局状态（角色、地点、时间线、基调）
 * - 决策日志（完整的执行轨迹）
 * - 置信度评分（由各步一致性评分聚合而成）
 * - IntentProfile（v3: 意图引擎分析结果）
 */

import type { IntentProfile } from './intent-engine-v3/index.js'

export interface WorkerMemoryStepState {
  status: 'pending' | 'running' | 'completed' | 'corrected'
  input?: any
  output?: any
  reflection?: StepReflection
  correctionCount: number
  latency: number
}

export interface StepReflection {
  consistencyScore: number       // 0-1
  emotionAlignment: number       // 0-1
  structureConflict: boolean
  riskFlags: string[]
  needsCorrection: boolean
  confidence: number             // 0-1
}

export interface DecisionLogEntry {
  step: string
  action: 'execute' | 'correct' | 'skip' | 'rollback'
  reason: string
  timestamp: number
}

export interface WorkerMemory {
  projectId: string
  intentProfile: IntentProfile | null
  scenarioHistory: any[]   // 多版本决策历史
  selectedScenario: any | null // 最终选择的版本
  rejectedScenarios: string[]  // 被否决的版本 ID
  episodeContext: {
    storyGoal: string
    emotionArc: string
    genreConstraints: string[]
    totalEpisodes: number
  }
  globalState: {
    characters: Record<string, any>
    locations: string[]
    timeline: any[]
    tone: string
  }
  stepStates: Record<string, WorkerMemoryStepState>
  decisionLog: DecisionLogEntry[]
  confidenceScore: number        // 最终 0-1
}

class WorkerMemoryManager {
  private memories = new Map<string, WorkerMemory>()

  create(
    projectId: string,
    context?: Partial<WorkerMemory['episodeContext']>,
  ): WorkerMemory {
    const mem: WorkerMemory = {
      projectId,
      intentProfile: null,
      scenarioHistory: [],
      selectedScenario: null,
      rejectedScenarios: [],
      episodeContext: {
        storyGoal: context?.storyGoal || 'unknown',
        emotionArc: context?.emotionArc || 'unknown',
        genreConstraints: context?.genreConstraints || [],
        totalEpisodes: context?.totalEpisodes || 60,
      },
      globalState: {
        characters: {},
        locations: [],
        timeline: [],
        tone: 'neutral',
      },
      stepStates: {},
      decisionLog: [],
      confidenceScore: 1.0,
    }
    this.memories.set(projectId, mem)
    return mem
  }

  get(projectId: string): WorkerMemory | undefined {
    return this.memories.get(projectId)
  }

  updateStepState(
    projectId: string,
    step: string,
    state: Partial<WorkerMemoryStepState>,
  ): boolean {
    const mem = this.memories.get(projectId)
    if (!mem) return false
    const existing = mem.stepStates[step] || {
      status: 'pending',
      correctionCount: 0,
      latency: 0,
    }
    mem.stepStates[step] = { ...existing, ...state }

    // 自动将 narrative 步骤的 pending/running 改为 completed（当有 output 时）
    if (step === 'narrative' && state.output && existing.status !== 'corrected') {
      mem.stepStates[step].status = 'completed'
    }
    return true
  }

  logDecision(projectId: string, entry: DecisionLogEntry): boolean {
    const mem = this.memories.get(projectId)
    if (!mem) return false
    mem.decisionLog.push(entry)
    return true
  }

  updateConfidence(projectId: string): number {
    const mem = this.memories.get(projectId)
    if (!mem) return 0
    const scores = Object.values(mem.stepStates)
      .filter(s => s.reflection)
      .map(s => s.reflection!.consistencyScore)
    if (scores.length === 0) return 1.0
    mem.confidenceScore = scores.reduce((a, b) => a + b, 0) / scores.length
    return mem.confidenceScore
  }

  getDecisionTrace(projectId: string): DecisionLogEntry[] {
    return this.memories.get(projectId)?.decisionLog || []
  }
}

export const workerMemoryManager = new WorkerMemoryManager()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

