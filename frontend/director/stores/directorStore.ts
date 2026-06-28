// director/stores/directorStore.ts — 导演工作台状态管理（全局单例）
// 不用 Pinia，保持简单 reactive，降低耦合

import { reactive, readonly } from 'vue'

// ─── 类型定义 ──────────────────────────────────────────

export interface SceneDef {
  id: string
  type: string
  description: string
  characters: string[]
  prompt?: string
}

export interface RuntimeState {
  currentSceneId: string | null
  currentShotIndex: number
  completedScenes: number
  totalScenes: number
  intensity: number
  playbackTime: number
  isPlaying: boolean
}

export interface SceneContext {
  sceneId: string
  status: string
  shotIndex: number
  sceneTime: number
  baseIntensity: number
  speedFactor: number
}

export interface IdentityVector {
  courage: number
  fear: number
  curiosity: number
  aggression: number
  stability: number
  attention: number
}

export interface MemorySnapshot {
  characters: Record<string, any>
  emotions: Record<string, any[]>
  causalChains: any[]
}

export interface AdaptiveDecision {
  rule: string
  action: string
  reason: string
}

export interface DirectorStore {
  // Session
  sessionKey: string | null
  pending: boolean
  error: string | null

  // StoryGraph
  scenes: SceneDef[]
  storyTitle: string

  // Runtime
  runtimeState: RuntimeState | null
  sceneContexts: Record<string, SceneContext>

  // Identity
  identity: Record<string, IdentityVector>

  // Memory
  memory: MemorySnapshot | null

  // Adaptive
  adaptiveDecisions: AdaptiveDecision[]

  // SSE
  connected: boolean
}

// 全局单例
let _instance: ReturnType<typeof _create> | null = null

function _create() {
  const defaultState: DirectorStore = {
    sessionKey: null,
    pending: false,
    error: null,
    scenes: [],
    storyTitle: '未命名故事',
    runtimeState: null,
    sceneContexts: {},
    identity: {},
    memory: null,
    adaptiveDecisions: [],
    connected: false,
  }

  const state = reactive<DirectorStore>({ ...defaultState })

  function reset() {
    Object.assign(state, { ...defaultState })
  }

  return {
    state: state as DirectorStore,
    raw: state,
    reset,
    setSession: (key: string) => { state.sessionKey = key },
    setScenes: (scenes: SceneDef[]) => { state.scenes = scenes },
    setRuntimeState: (s: RuntimeState | null, ctx: Record<string, SceneContext>) => {
      state.runtimeState = s
      state.sceneContexts = ctx || {}
    },
    setIdentity: (id: Record<string, IdentityVector>) => { state.identity = id },
    setMemory: (mem: MemorySnapshot | null) => { state.memory = mem },
    addAdaptiveDecision: (d: AdaptiveDecision) => { state.adaptiveDecisions.push(d) },
    setConnected: (v: boolean) => { state.connected = v },
    setPending: (v: boolean) => { state.pending = v },
    setError: (e: string | null) => { state.error = e },
  }
}

export function createDirectorStore() {
  if (!_instance) {
    _instance = _create()
  }
  return _instance
}
