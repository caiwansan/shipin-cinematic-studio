/**
 * Director Runtime Store
 * Runtime Binding Layer — 核心运行时状态层
 *
 * 这是 Director Workbench UI 的灵魂：将后端五根支柱的 runtime 数据
 * 映射为前端可响应式监听、可编辑的统一状态树。
 *
 * 结构：
 *   timeline: 时间轴线（镜头序列 + 五支柱每镜数据）
 *   grammar: 语法树状态
 *   motion: 运动规划状态
 *   temporal: 连续性状态
 *   persistence: 角色一致性状态
 *   canvas: 画布状态（播放/选中/缩放）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── 类型定义 ─────────────────────────────────

export interface TimelineShot {
  id: string
  index: number
  description: string
  duration: number // 秒

  // 五支柱数据（每个镜头独立）
  grammarType: string
  grammarIntensity: number
  emotionalTension: number
  emotionalMood: string

  motionStyle: string
  motionDirective: string
  motionPressure: number
  motionInstability: number
  motionEnergyFlow: number

  temporalContinuity: number
  temporalHintNeeded: boolean

  characterStable: boolean
  characterDrift: number

  // 视觉状态
  selected: boolean
  hovered: boolean
}

export interface EmotionalCurvePoint {
  shotIndex: number
  tension: number
  mood: string
}

export interface MotionOverlay {
  type: 'camera_path' | 'velocity' | 'acceleration' | 'shake'
  data: number[]
  visible: boolean
}

export interface DirectorRuntimeState {
  // 项目元数据
  projectId: string | null
  projectName: string

  // 时间轴
  timeline: TimelineShot[]
  currentShotIndex: number
  isPlaying: boolean
  playbackTime: number

  // 语法树
  grammarPreset: string
  showGrammarGraph: boolean

  // 运动叠加
  motionOverlays: MotionOverlay[]

  // 情绪弧线
  showEmotionArc: boolean

  // 角色身份
  characterId: string | null

  // 结果汇总
  summary: string
}

// ─── Store ────────────────────────────────────

export const useDirectorRuntimeStore = defineStore('director-runtime', () => {
  // ── 状态 ──
  const state = ref<DirectorRuntimeState>({
    projectId: null,
    projectName: '',
    timeline: [],
    currentShotIndex: 0,
    isPlaying: false,
    playbackTime: 0,
    grammarPreset: 'classic_three_act',
    showGrammarGraph: true,
    motionOverlays: [
      { type: 'camera_path', data: [], visible: true },
      { type: 'velocity', data: [], visible: false },
      { type: 'acceleration', data: [], visible: false },
      { type: 'shake', data: [], visible: false },
    ],
    showEmotionArc: true,
    characterId: null,
    summary: '',
  })

  // ── 计算属性 ──
  const currentShot = computed(() =>
    state.value.timeline[state.value.currentShotIndex] ?? null,
  )

  const totalShots = computed(() => state.value.timeline.length)

  const totalDuration = computed(() =>
    state.value.timeline.reduce((sum, s) => sum + s.duration, 0),
  )

  const emotionalCurve = computed<EmotionalCurvePoint[]>(() =>
    state.value.timeline.map(s => ({
      shotIndex: s.index,
      tension: s.emotionalTension,
      mood: s.emotionalMood,
    })),
  )

  const continuityState = computed(() => {
    const low = state.value.timeline.filter(s => s.temporalContinuity < 0.4)
    return {
      average: state.value.timeline.reduce((a, s) => a + s.temporalContinuity, 0) / Math.max(state.value.timeline.length, 1),
      weakLinks: low.length,
      status: low.length === 0 ? 'stable' : 'warning',
    }
  })

  const motionProfile = computed(() => ({
    avgPressure: state.value.timeline.reduce((a, s) => a + s.motionPressure, 0) / Math.max(state.value.timeline.length, 1),
    avgInstability: state.value.timeline.reduce((a, s) => a + s.motionInstability, 0) / Math.max(state.value.timeline.length, 1),
  }))

  // ── 操作 ──

  function loadFromApi(result: any) {
    if (!result || !result.injected) return

    state.value.timeline = result.injected.map((item: any, i: number) => ({
      id: `shot_${i + 1}`,
      index: i,
      description: item.shot?.raw ?? '',
      duration: 2,
      grammarType: item.shot?.camera?.type ?? 'build_up',
      grammarIntensity: item.continuityScore ?? 0.5,
      emotionalTension: item.emotionalTension ?? 0.5,
      emotionalMood: item.mood ?? 'calm',
      motionStyle: item.motionStyle ?? 'static',
      motionDirective: item.motionDirective ?? '',
      motionPressure: item.intent?.pressure ?? 0,
      motionInstability: item.intent?.instability ?? 0,
      motionEnergyFlow: item.intent?.energyFlow ?? 0,
      temporalContinuity: item.continuityScore ?? 1,
      temporalHintNeeded: item.hadTransitionHint ?? false,
      characterStable: true,
      characterDrift: 0,
      selected: i === 0,
      hovered: false,
    }))
  }

  function selectShot(index: number) {
    state.value.timeline.forEach((s, i) => {
      s.selected = i === index
    })
    state.value.currentShotIndex = index
  }

  function reorderShot(fromIndex: number, toIndex: number) {
    const shots = [...state.value.timeline]
    const [moved] = shots.splice(fromIndex, 1)
    shots.splice(toIndex, 0, moved)
    // 重新编号
    state.value.timeline = shots.map((s, i) => ({ ...s, index: i }))
  }

  function updateShotDuration(index: number, duration: number) {
    if (state.value.timeline[index]) {
      state.value.timeline[index].duration = Math.max(0.5, Math.min(duration, 10))
    }
  }

  function togglePlay() {
    state.value.isPlaying = !state.value.isPlaying
  }

  function seekTo(time: number) {
    state.value.playbackTime = Math.max(0, Math.min(time, totalDuration.value))
  }

  function toggleMotionOverlay(type: MotionOverlay['type']) {
    const overlay = state.value.motionOverlays.find(o => o.type === type)
    if (overlay) overlay.visible = !overlay.visible
  }

  function toggleGrammarGraph() {
    state.value.showGrammarGraph = !state.value.showGrammarGraph
  }

  function toggleEmotionArc() {
    state.value.showEmotionArc = !state.value.showEmotionArc
  }

  function reset() {
    state.value.timeline = []
    state.value.currentShotIndex = 0
    state.value.isPlaying = false
    state.value.playbackTime = 0
  }

  return {
    state,
    currentShot,
    totalShots,
    totalDuration,
    emotionalCurve,
    continuityState,
    motionProfile,
    loadFromApi,
    selectShot,
    reorderShot,
    updateShotDuration,
    togglePlay,
    seekTo,
    toggleMotionOverlay,
    toggleGrammarGraph,
    toggleEmotionArc,
    reset,
  }
})
