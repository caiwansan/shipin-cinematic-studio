/**
 * realtime-scene.ts — Phase 6G: Real-Time Cinematic Runtime
 *
 * 核心升级：从 batch-driven 升级为 live scene system。
 *
 * 关键设计决策：
 *   - scene = 持续演化状态，不是 render job
 *   - tick() 模拟帧推进，输出 streaming frame
 *   - mutation gate 确保运行时修改受到 constitution 约束
 *   - frame rate 受 semantic energy 动态调整
 */
import type { CinematicIntentVector, SemanticEnergySummary } from '../runtime/cinematic-intent.js'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Frame Stream
// ============================================================

export interface StreamFrame {
  frameId: number
  sceneId: string
  /** frame-level render instructions（可以被 backend 消费） */
  instructions: Record<string, unknown>
  /** 该帧的 continuity key */
  continuityKey: string
  /** 帧的时间位置（tick） */
  tick: number
  /** 帧的状态 */
  status: 'pending' | 'rendering' | 'rendered' | 'skipped'
}

export interface FrameStream {
  frames: StreamFrame[]
  totalFrames: number
  startedAt: number
  currentTick: number
  fps: number
}

// ============================================================
// Scene State — 持续演化状态
// ============================================================

export interface SceneState {
  sceneId: string
  activeTick: number
  emotionalState: Record<string, number>
  narrativeState: {
    phase: string
    progression: number
  }
  visualState: {
    colorPalette: string
    lighting: string
    cameraAngle: string
  }
  driftLevel: number
  energy: number
  isLive: boolean
  lastMutationAt: number | null
}

// ============================================================
// Runtime Mutation — 运行时修改指令
// ============================================================

export interface RuntimeMutation {
  type: 'emotion_shift' | 'narrative_pivot' | 'visual_override' | 'pacing_change'
  target: string
  value: unknown
  /** 突变强度 (0-1) */
  intensity: number
  /** 是否必须受 constitution 约束检查 */
  requireConstitutionCheck: boolean
}

export interface MutationResult {
  applied: boolean
  newState: SceneState
  /** 突变导致的 drift delta */
  driftDelta: number
  rejected: boolean
  rejectReason: string | null
}

// ============================================================
// Feedback Signal — 外部反馈回环
// ============================================================

export interface FeedbackSignal {
  type: 'viewer_reaction' | 'drift_detected' | 'director_override'
  value: number
  timestamp: number
}

// ============================================================
// Scene Registry — 管理所有活场景
// ============================================================

export class LiveSceneRegistry {
  private scenes: Map<string, SceneState> = new Map()
  private constitutionMap: Map<string, StoryConstitution> = new Map()
  private streams: Map<string, FrameStream> = new Map()

  register(
    sceneId: string,
    initialState: Partial<SceneState>,
    constitution: StoryConstitution,
  ): SceneState {
    const state: SceneState = {
      sceneId,
      activeTick: 0,
      emotionalState: { tension: 0.5, joy: 0.3, sadness: 0.1 },
      narrativeState: { phase: 'setup', progression: 0 },
      visualState: { colorPalette: 'natural', lighting: 'day', cameraAngle: 'medium' },
      driftLevel: 0,
      energy: 0.5,
      isLive: true,
      lastMutationAt: null,
      ...initialState,
    }
    this.scenes.set(sceneId, state)
    this.constitutionMap.set(sceneId, constitution)
    this.streams.set(sceneId, { frames: [], totalFrames: 0, startedAt: Date.now(), currentTick: 0, fps: 24 })
    return state
  }

  getState(sceneId: string): SceneState | undefined {
    return this.scenes.get(sceneId)
  }

  getStream(sceneId: string): FrameStream | undefined {
    return this.streams.get(sceneId)
  }

  getAllStates(): SceneState[] {
    return Array.from(this.scenes.values())
  }

  /** end 一个活场景 */
  endScene(sceneId: string): void {
    const state = this.scenes.get(sceneId)
    if (state) state.isLive = false
  }

  /** 移除场景 */
  removeScene(sceneId: string): void {
    this.scenes.delete(sceneId)
    this.constitutionMap.delete(sceneId)
    this.streams.delete(sceneId)
  }
}

// ============================================================
// Mutation Gate — 运行时突变受 constitution 约束
// ============================================================

export class MutationGate {
  /**
   * 检查 mutation 是否违反 constitution 约束
   *
   * 规则：
   *   - emotion_shift 超过 ±0.3/tick → deny
   *   - narrative_pivot 可能触发 drift warning
   *   - visual_override 改变 forbiddenStyles → deny
   *   - pacing_change > 2x → deny
   */
  check(
    mutation: RuntimeMutation,
    state: SceneState,
    constitution: StoryConstitution,
  ): { allowed: boolean; reason: string | null } {
    switch (mutation.type) {
      case 'emotion_shift': {
        if (typeof mutation.value === 'number' && Math.abs(mutation.value) > 0.3) {
          return { allowed: false, reason: 'emotion shift exceeds max delta 0.3/tick' }
        }
        return { allowed: true, reason: null }
      }

      case 'narrative_pivot': {
        const currentPhase = state.narrativeState.phase
        if (currentPhase === 'climax' && mutation.value === 'setup') {
          return { allowed: false, reason: 'cannot regress narrative from climax to setup' }
        }
        return { allowed: true, reason: null }
      }

      case 'visual_override': {
        const forbidden = (constitution as any).forbiddenStyles
        if (Array.isArray(forbidden) && forbidden.includes(mutation.value)) {
          return { allowed: false, reason: `visual ${mutation.value} is in forbiddenStyles` }
        }
        return { allowed: true, reason: null }
      }

      case 'pacing_change': {
        if (typeof mutation.value === 'number' && mutation.value > 2) {
          return { allowed: false, reason: 'pacing change > 2x denied' }
        }
        return { allowed: true, reason: null }
      }

      default:
        return { allowed: false, reason: `unknown mutation type: ${mutation.type}` }
    }
  }
}

// ============================================================
// Scene Runtime — 核心实时循环
// ============================================================

export class SceneRuntime {
  private states: Map<string, SceneState> = new Map()
  private streams: Map<string, FrameStream> = new Map()
  private mutationGate = new MutationGate()

  /** 注册场景 */
  register(sceneId: string, state: SceneState, constitution: StoryConstitution): void {
    this.states.set(sceneId, state)
    this.streams.set(sceneId, {
      frames: [],
      totalFrames: 0,
      startedAt: Date.now(),
      currentTick: 0,
      fps: 24,
    })
  }

  /** 获取场景状态 */
  getState(sceneId: string): SceneState | undefined {
    return this.states.get(sceneId)
  }

  /** 获取帧流 */
  getStream(sceneId: string): FrameStream | undefined {
    return this.streams.get(sceneId)
  }

  /**
   * 推进一帧（tick）
   *
   * 核心逻辑：
   *   1. tick +1
   *   2. 根据当前 energy 决定是否 emit frame
   *   3. 根据 driftLevel 衰减 energy
   *   4. 动态调整 fps
   */
  tick(sceneId: string): StreamFrame | null {
    const state = this.states.get(sceneId)
    const stream = this.streams.get(sceneId)
    if (!state || !stream || !state.isLive) return null

    state.activeTick++
    stream.currentTick = state.activeTick

    // 根据 energy 决定是否丢帧
    if (state.energy < 0.2) {
      // low energy → skip frame production, just advance tick
      // 但 drift 积累不受影响
      state.driftLevel = Math.min(1, state.driftLevel + 0.02)
      return null
    }

    state.energy = Math.max(0, state.energy - 0.005)

    // 动态 fps 调整
    stream.fps = this.calculateFPS(state)

    // 生成帧指令
    const frame: StreamFrame = {
      frameId: stream.frames.length + 1,
      sceneId,
      instructions: this.buildInstructions(state),
      continuityKey: `${sceneId}:tick:${state.activeTick}`,
      tick: state.activeTick,
      status: 'pending',
    }

    stream.frames.push(frame)
    stream.totalFrames++

    return frame
  }

  /**
   * 运行时突变
   */
  mutate(
    sceneId: string,
    mutation: RuntimeMutation,
    constitution: StoryConstitution,
  ): MutationResult {
    const state = this.states.get(sceneId)
    if (!state) {
      return { applied: false, newState: null as unknown as SceneState, driftDelta: 0, rejected: true, rejectReason: 'scene not found' }
    }

    // constitution check
    const gateResult = this.mutationGate.check(mutation, state, constitution)
    if (!gateResult.allowed) {
      return { applied: false, newState: state, driftDelta: 0, rejected: true, rejectReason: gateResult.reason! }
    }

    // 应用 mutation
    const prevState = { ...state }
    this.applyMutation(state, mutation)

    state.lastMutationAt = Date.now()

    // 计算 drift delta
    const driftDelta = mutation.intensity * 0.1
    state.driftLevel = Math.min(1, state.driftLevel + driftDelta)

    // mutation 消耗 energy
    state.energy = Math.max(0, state.energy - mutation.intensity * 0.05)

    return { applied: true, newState: state, driftDelta, rejected: false, rejectReason: null }
  }

  /**
   * 注入反馈信号
   */
  injectFeedback(sceneId: string, signal: FeedbackSignal): void {
    const state = this.states.get(sceneId)
    if (!state) return

    switch (signal.type) {
      case 'viewer_reaction':
        // 观众反馈反向影响 emotionalState
        state.emotionalState.tension = Math.max(0, Math.min(1, state.emotionalState.tension + signal.value * 0.1))
        break
      case 'drift_detected':
        state.driftLevel = Math.min(1, state.driftLevel + signal.value)
        break
      case 'director_override':
        state.energy = Math.min(1, state.energy + signal.value * 0.2)
        break
    }
  }

  private calculateFPS(state: SceneState): number {
    // energy 越高 fps 越高
    const baseFPS = 24
    const energyBoost = state.energy * 12 // max 12 fps extra
    const driftPenalty = state.driftLevel * 8 // max -8 fps
    return Math.max(8, Math.min(60, baseFPS + energyBoost - driftPenalty))
  }

  private buildInstructions(state: SceneState): Record<string, unknown> {
    return {
      emotion: { ...state.emotionalState },
      narrative: { ...state.narrativeState },
      visual: { ...state.visualState },
      tick: state.activeTick,
    }
  }

  private applyMutation(state: SceneState, mutation: RuntimeMutation): void {
    switch (mutation.type) {
      case 'emotion_shift': {
        if (typeof mutation.value === 'object' && mutation.value !== null) {
          Object.assign(state.emotionalState, mutation.value)
        } else if (typeof mutation.value === 'number') {
          // 值表示 tension 移位
          state.emotionalState.tension = Math.max(0, Math.min(1, state.emotionalState.tension + mutation.value))
        }
        break
      }
      case 'narrative_pivot': {
        if (typeof mutation.value === 'object' && mutation.value !== null) {
          Object.assign(state.narrativeState, mutation.value)
        } else if (typeof mutation.value === 'string') {
          state.narrativeState.phase = mutation.value
        }
        break
      }
      case 'visual_override': {
        if (typeof mutation.value === 'object' && mutation.value !== null) {
          Object.assign(state.visualState, mutation.value)
        } else if (typeof mutation.value === 'string') {
          state.visualState.colorPalette = mutation.value
        }
        break
      }
      case 'pacing_change': {
        if (typeof mutation.value === 'number') {
          state.energy = Math.min(1, state.energy + mutation.value * 0.1)
        }
        break
      }
    }
  }
}

// ============================================================
// Realtime Controller — 统一入口
// ============================================================

export class RealtimeController {
  runtime = new SceneRuntime()
  registry = new LiveSceneRegistry()

  /**
   * 开始一个活场景
   */
  start(
    sceneId: string,
    initialState: Partial<SceneState>,
    constitution: StoryConstitution,
  ): SceneState {
    const state = this.registry.register(sceneId, initialState, constitution)
    this.runtime.register(sceneId, state, constitution)
    return state
  }

  /**
   * 推进场景到指定 tick
   */
  advance(sceneId: string, ticks: number = 1): StreamFrame[] {
    const frames: StreamFrame[] = []
    for (let i = 0; i < ticks; i++) {
      const frame = this.runtime.tick(sceneId)
      if (frame) frames.push(frame)
    }
    return frames
  }

  /**
   * 突变
   */
  mutate(
    sceneId: string,
    mutation: RuntimeMutation,
    constitution: StoryConstitution,
  ): MutationResult {
    return this.runtime.mutate(sceneId, mutation, constitution)
  }

  /**
   * 反馈
   */
  feedback(sceneId: string, signal: FeedbackSignal): void {
    this.runtime.injectFeedback(sceneId, signal)
  }

  /**
   * 终止场景
   */
  end(sceneId: string): void {
    this.registry.endScene(sceneId)
  }
}

// ============================================================
// Policy
// ============================================================

export const REALTIME_POLICY = {
  allowMidSceneMutation: true,
  allowEmotionOverride: true,
  maxMutationIntensity: 0.3,
  minFPS: 8,
  maxFPS: 60,
  defaultFPS: 24,
  energyDrainPerTick: 0.005,
  driftAccumPerTick: 0.02,
  driftFromMutation: 0.1,
  energyCostPerMutation: 0.05,
  forbidden: [
    'full_scene_reset',
    'identity_wipe',
    'timeline_rewind',
    'character_deletion',
  ] as readonly string[],
}
