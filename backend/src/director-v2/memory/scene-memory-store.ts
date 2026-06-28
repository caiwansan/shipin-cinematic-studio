/**
 * memory/scene-memory-store.ts — Phase 7 场景记忆存储
 *
 * 存储每个场景执行的快照：outcome、pacing 结果、mutation 历史
 * 不是日志——是结构化状态快照
 *
 * 宪法：
 *   - 每个场景最多保留一个快照（运行后更新）
 *   - 不可变成原始日志
 *   - 不可修改 IR/Timeline/ExecutionPlan
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface SceneOutcome {
  completed: boolean
  totalShots: number
  executedShots: number
  finalIntensity: number
  finalSpeedFactor: number
  durationTicks: number
}

export interface SceneMemory {
  sceneId: string
  sceneType: string
  outcome: SceneOutcome | null
  intensityHistory: { tick: number; intensity: number }[]
  mutationHistory: { tick: number; action: string; params: Record<string, unknown> }[]
  lastSeenTick: number
}

// ─── SceneMemoryStore ──────────────────────────────────

export class SceneMemoryStore {
  private scenes = new Map<string, SceneMemory>()
  private executionOrder: string[] = []

  /** 注册新场景 */
  initScene(sceneId: string, sceneType: string): SceneMemory {
    const sm: SceneMemory = {
      sceneId,
      sceneType,
      outcome: null,
      intensityHistory: [],
      mutationHistory: [],
      lastSeenTick: 0,
    }
    this.scenes.set(sceneId, sm)
    this.executionOrder.push(sceneId)
    return sm
  }

  /** 记录强度快照 */
  recordIntensity(sceneId: string, tick: number, intensity: number): void {
    const sm = this.scenes.get(sceneId)
    if (!sm) return
    sm.intensityHistory.push({ tick, intensity })
    sm.lastSeenTick = tick
  }

  /** 记录 mutation */
  recordMutation(sceneId: string, tick: number, action: string, params: Record<string, unknown>): void {
    const sm = this.scenes.get(sceneId)
    if (!sm) return
    sm.mutationHistory.push({ tick, action, params })
  }

  /** 标记场景完成并记录 outcome */
  completeScene(sceneId: string, outcome: SceneOutcome): void {
    const sm = this.scenes.get(sceneId)
    if (!sm) return
    sm.outcome = outcome
  }

  /** 查询场景是否存在 */
  hasScene(sceneId: string): boolean {
    return this.scenes.has(sceneId)
  }

  /** 获取场景记忆 */
  getScene(sceneId: string): SceneMemory | undefined {
    return this.scenes.get(sceneId)
  }

  /** 按执行顺序获取所有场景 */
  getExecutionOrder(): SceneMemory[] {
    return this.executionOrder.map(id => this.scenes.get(id)!).filter(Boolean)
  }

  /** 获取已完成场景列表（可重复性检查） */
  getCompletedScenes(): SceneMemory[] {
    return this.getExecutionOrder().filter(s => s.outcome?.completed)
  }

  /** 查询场景类型 */
  getSceneType(sceneId: string): string | undefined {
    return this.scenes.get(sceneId)?.sceneType
  }

  /** 导出快照（结构化） */
  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [id, sm] of this.scenes) {
      out[id] = {
        type: sm.sceneType,
        completed: sm.outcome?.completed ?? false,
        durationTicks: sm.outcome?.durationTicks ?? null,
        finalIntensity: sm.outcome?.finalIntensity ?? null,
        mutationCount: sm.mutationHistory.length,
        intensitySamples: sm.intensityHistory.length,
      }
    }
    return out
  }

  clear(): void {
    this.scenes.clear()
    this.executionOrder = []
  }
}

export default SceneMemoryStore
