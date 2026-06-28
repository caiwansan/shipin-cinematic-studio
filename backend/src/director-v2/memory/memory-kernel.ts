/**
 * memory/memory-kernel.ts — Phase 7 记忆内核（主入口）
 *
 * 编排所有记忆子系统的消费/更新/输出
 *
 * 接口：consume(runtimeState, sceneResult, characters?) → MemorySnapshot
 *
 * 宪法：
 *   - 不修改 IR / Timeline / ExecutionPlan
 *   - 结构化图数据，非文本日志
 *   - session 级存储，可重建
 *   - 可被 Adaptive Kernel 消费
 */

import CharacterMemoryGraph from './character-memory-graph.js'
import SceneMemoryStore from './scene-memory-store.js'
import EmotionHistory from './emotion-history.js'
import CausalEventChain from './causal-event-chain.js'
import type { PlaybackControllerState } from '../runtime/playback-controller.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface SceneResult {
  sceneId: string
  sceneType: string
  intensity: number
  speedFactor: number
  completed: boolean
  totalShots: number
  executedShots: number
  durationTicks: number
  characterEmotions?: Array<{
    characterId: string
    characterName: string
    emotion: string
    valence: number
    arousal: number
  }>
  mutationActions?: Array<{ action: string; params: Record<string, unknown> }>
}

export interface MemorySnapshot {
  characters: Record<string, unknown>
  scenes: Record<string, unknown>
  emotion: Record<string, unknown>
  causal: Record<string, unknown>
  summary: string
}

// ─── MemoryKernel ──────────────────────────────────────

export class MemoryKernel {
  public readonly characters: CharacterMemoryGraph
  public readonly scenes: SceneMemoryStore
  public readonly emotion: EmotionHistory
  public readonly causal: CausalEventChain

  private tickCount = 0

  constructor() {
    this.characters = new CharacterMemoryGraph()
    this.scenes = new SceneMemoryStore()
    this.emotion = new EmotionHistory()
    this.causal = new CausalEventChain()
  }

  /** 初始化场景（首次使用时调用） */
  initScene(sceneId: string, sceneType: string): void {
    if (!this.scenes.hasScene(sceneId)) {
      this.scenes.initScene(sceneId, sceneType)
    }
  }

  /** 消费 runtime state（每次 tick 调用） */
  consumeTick(runtimeState: PlaybackControllerState): void {
    const rs = runtimeState.runtimeState
    const currentSceneId = rs.currentSceneId ?? '__null__'
    const sceneCtx = runtimeState.sceneContexts?.[currentSceneId]

    // 记录强度到场景记忆
    if (currentSceneId !== '__null__') {
      this.scenes.recordIntensity(currentSceneId, this.tickCount, rs.intensity)
    }

    // 记录全局情绪
    this.emotion.record(null, {
      tick: this.tickCount,
      sceneId: currentSceneId,
      valence: rs.intensity,
      arousal: rs.intensity, // 简化：暂无独立 arousal
      intensity: rs.intensity,
    })

    // 记录角色情绪（如果有场景上下文）
    if (sceneCtx) {
      // 从 sceneCtx 中推导角色 ID（shot 的 subject）
      // 简化方案：用一个虚拟角色代表主视角
    }

    this.tickCount++
  }

  /** 消费场景完成结果 */
  consumeSceneResult(result: SceneResult): void {
    // 记录场景 outcome
    this.scenes.completeScene(result.sceneId, {
      completed: result.completed,
      totalShots: result.totalShots,
      executedShots: result.executedShots,
      finalIntensity: result.intensity,
      finalSpeedFactor: result.speedFactor,
      durationTicks: result.durationTicks,
    })

    // 记录角色情绪
    for (const ce of result.characterEmotions ?? []) {
      this.characters.ensureCharacter(ce.characterId, ce.characterName)
      this.characters.recordEmotion(ce.characterId, result.sceneId, ce.emotion, ce.valence, ce.arousal, result.intensity, this.tickCount)
      this.emotion.record(ce.characterId, {
        tick: this.tickCount,
        sceneId: result.sceneId,
        valence: ce.valence,
        arousal: ce.arousal,
        intensity: result.intensity,
      })
    }

    // 记录 mutation
    for (const ma of result.mutationActions ?? []) {
      this.scenes.recordMutation(result.sceneId, this.tickCount, ma.action, ma.params)
    }
  }

  /** 记录场景间因果链接 */
  recordCausalLink(
    causeScene: string,
    effectScene: string,
    linkType: CausalEventChain['links'][0]['linkType'],
    intensityDelta: number,
    description: string,
  ): void {
    this.causal.addLink(causeScene, effectScene, linkType, intensityDelta, description)
  }

  /** 导出完整记忆快照（给 Adaptive Kernel / 序列化） */
  snapshot(): MemorySnapshot {
    const chars = this.characters.snapshot()
    const scenes = this.scenes.snapshot()
    const emotion = this.emotion.snapshot()
    const causal = this.causal.snapshot()

    // 生成总结
    const charCount = Object.keys(chars).length
    const sceneCount = Object.keys(scenes).length
    const causalCount = (causal.totalLinks as number) ?? 0
    const summary = `共 ${charCount} 个角色、${sceneCount} 个场景、${causalCount} 条因果链，${this.tickCount} tick 数据`

    return { characters: chars, scenes, emotion, causal, summary }
  }

  /** 重置 */
  clear(): void {
    this.characters.clear()
    this.scenes.clear()
    this.emotion.clear()
    this.causal.clear()
    this.tickCount = 0
  }
}

export default MemoryKernel
