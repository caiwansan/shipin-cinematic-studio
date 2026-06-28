/**
 * Director Replay Store
 * 导演回放状态层 — trace 事件缓存 + 游标 + 播放控制
 *
 * 整个 store 是"外挂式"的，不替代现有的 director-runtime-store，
 * 而是提供一个 shadow layer。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface DirectorTraceEvent {
  traceId: string
  timestamp: number
  layer: 'shot' | 'grammar' | 'motion' | 'character' | 'temporal'
  type: string
  payload: any
  seq: number
  shotIndex?: number
}

export interface ReplaySnapshot {
  seq: number
  timeline: any[]
  emotionalCurve: any[]
  motionEnergyFlow: number[]
  grammarGraph: any
  characterStates: any
  temporalContinuity: number[]
}

export const useDirectorReplayStore = defineStore('director-replay', () => {
  // ── 状态 ──
  const traceEvents = ref<DirectorTraceEvent[]>([])
  const snapshots = ref<ReplaySnapshot[]>([])
  const cursor = ref(0)       // 当前播放到的事件 seq
  const isPlaying = ref(false)
  const replaySpeed = ref(1)  // 1x / 2x / 0.5x
  const liveMode = ref(false) // true = replay, false = normal
  const traceId = ref<string | null>(null)
  const eventSource = ref<EventSource | null>(null)
  const totalEvents = ref(0)

  let animationFrameId: number | null = null
  let lastTick = 0

  // ── 计算属性 ──
  const progress = computed(() =>
    totalEvents.value > 0 ? cursor.value / totalEvents.value : 0,
  )

  const currentEvent = computed<DirectorTraceEvent | null>(() =>
    traceEvents.value.find(e => e.seq === cursor.value) ?? null,
  )

  const currentSnapshot = computed<ReplaySnapshot | null>(() =>
    snapshots.value.find(s => s.seq === cursor.value) ?? null,
  )

  const layerEvents = computed(() => {
    const grouped: Record<string, DirectorTraceEvent[]> = {}
    for (const e of traceEvents.value) {
      if (!grouped[e.layer]) grouped[e.layer] = []
      grouped[e.layer].push(e)
    }
    return grouped
  })

  const activeShots = computed(() => {
    const shots: any[] = []
    for (const e of traceEvents.value.slice(0, cursor.value + 1)) {
      if (e.layer === 'shot' && e.type === 'SHOT_COMPILED') {
        shots.push({ index: e.payload.index ?? shots.length, data: e.payload })
      }
      if (e.layer === 'grammar' && e.type === 'SHOT_GRAMMAR_RESOLVED') {
        const existing = shots.find(s => s.data?.text === e.payload?.text)
        if (existing) existing.grammarType = e.payload.grammarType
      }
      if (e.layer === 'motion' && e.type === 'MOTION_INTENT_COMPUTED') {
        const existing = shots.find(s => s.data?.index === e.payload?.shotIndex)
        if (existing) existing.motionStyle = e.payload.motionStyle
      }
    }
    return shots
  })

  const activeEmotionCurve = computed(() => {
    const curve: { shot: number; tension: number; mood: string }[] = []
    for (const e of traceEvents.value.slice(0, cursor.value + 1)) {
      if (e.layer === 'grammar' && e.type === 'EMOTION_COMPUTED') {
        curve.push(e.payload)
      }
    }
    return curve
  })

  const activeMotionEvents = computed(() => {
    const motions: any[] = []
    for (const e of traceEvents.value.slice(0, cursor.value + 1)) {
      if (e.layer === 'motion' && e.type === 'MOTION_INTENT_COMPUTED') {
        motions.push(e.payload)
      }
      if (e.layer === 'motion' && e.type === 'PHYSICS_VALIDATED') {
        motions.push(e.payload)
      }
    }
    return motions
  })

  // ── 操作 ──

  function appendEvent(event: DirectorTraceEvent) {
    traceEvents.value.push(event)
    totalEvents.value++
  }

  function setSnapshots(snaps: ReplaySnapshot[]) {
    snapshots.value = snaps
  }

  function setTotal(n: number) {
    totalEvents.value = n
  }

  function seek(index: number) {
    cursor.value = Math.max(0, Math.min(index, totalEvents.value))
  }

  function stepForward() {
    seek(cursor.value + 1)
  }

  function stepBackward() {
    seek(cursor.value - 1)
  }

  function play() {
    if (isPlaying.value) return
    isPlaying.value = true
    lastTick = performance.now()
    tick()
  }

  function pause() {
    isPlaying.value = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function togglePlay() {
    if (isPlaying.value) pause()
    else play()
  }

  function tick() {
    if (!isPlaying.value) return
    const now = performance.now()
    const delta = (now - lastTick) / 1000 // seconds
    lastTick = now

    // 每秒前进 3 个事件（按速度倍率）
    const step = Math.max(1, Math.round(delta * 3 * replaySpeed.value))
    seek(cursor.value + step)

    if (cursor.value >= totalEvents.value) {
      pause()
      return
    }

    animationFrameId = requestAnimationFrame(tick)
  }

  function setReplaySpeed(speed: number) {
    replaySpeed.value = Math.max(0.25, Math.min(speed, 4))
  }

  function toggleLiveMode() {
    liveMode.value = !liveMode.value
    if (!liveMode.value) reset()
  }

  function connectSSE(tid: string) {
    if (eventSource.value) {
      eventSource.value.close()
    }

    traceId.value = tid
    liveMode.value = true
    reset()

    const es = new EventSource(
      `https://aigc.fushtn.com/api/workbench/replay/stream/${tid}`,
    )

    es.addEventListener('trace', (e) => {
      const data = JSON.parse(e.data)
      appendEvent({
        traceId: tid,
        timestamp: Date.now(),
        layer: data.layer,
        type: data.type,
        payload: data.payload,
        seq: data.seq,
      })
    })

    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data)
      setSnapshots([...snapshots.value, data.snapshot])
    })

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      setTotal(data.totalEvents ?? data.currentSeq ?? 0)
    })

    es.addEventListener('done', () => {
      pause()
      es.close()
    })

    es.onerror = () => {
      console.error('Replay SSE error')
    }

    eventSource.value = es
  }

  function disconnectSSE() {
    if (eventSource.value) {
      eventSource.value.close()
      eventSource.value = null
    }
  }

  function reset() {
    pause()
    traceEvents.value = []
    snapshots.value = []
    cursor.value = 0
    totalEvents.value = 0
    traceId.value = null
  }

  return {
    traceEvents,
    snapshots,
    cursor,
    isPlaying,
    replaySpeed,
    liveMode,
    traceId,
    totalEvents,
    progress,
    currentEvent,
    currentSnapshot,
    layerEvents,
    activeShots,
    activeEmotionCurve,
    activeMotionEvents,
    appendEvent,
    setSnapshots,
    setTotal,
    seek,
    stepForward,
    stepBackward,
    play,
    pause,
    togglePlay,
    setReplaySpeed,
    toggleLiveMode,
    connectSSE,
    disconnectSSE,
    reset,
  }
})
