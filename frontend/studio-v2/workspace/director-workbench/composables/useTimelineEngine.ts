/**
 * Timeline Engine Composables
 * Timeline Engine — 导演时间轴逻辑
 *
 * 提供时间轴的核心交互能力：
 *   - 拖拽重排镜头
 *   - 拉伸/缩短镜头时长
 *   - scrub 预览
 *   - 拆分/合并镜头
 */

import { computed, ref } from 'vue'
import { useDirectorRuntimeStore, TimelineShot } from '../stores/director-runtime-store'

export function useTimelineEngine() {
  const store = useDirectorRuntimeStore()
  const dragState = ref<{
    isDragging: boolean
    fromIndex: number | null
    hoverIndex: number | null
    dragType: 'reorder' | 'resize' | null
    resizeSide: 'left' | 'right' | null
  }>({
    isDragging: false,
    fromIndex: null,
    hoverIndex: null,
    dragType: null,
    resizeSide: null,
  })

  // 每个镜头在时间轴中的累积起始位置
  const shotPositions = computed(() => {
    let accum = 0
    return store.state.timeline.map((shot, i) => {
      const start = accum
      accum += shot.duration
      return { index: i, start, end: accum, duration: shot.duration }
    })
  })

  // 时间轴总宽度（以秒为单位）
  const totalDuration = computed(() =>
    store.state.timeline.reduce((sum, s) => sum + s.duration, 0),
  )

  // ── 交互函数 ──

  function startDrag(index: number, event: MouseEvent) {
    dragState.value = {
      isDragging: true,
      fromIndex: index,
      hoverIndex: index,
      dragType: 'reorder',
      resizeSide: null,
    }
  }

  function startResize(index: number, side: 'left' | 'right', event: MouseEvent) {
    dragState.value = {
      isDragging: true,
      fromIndex: index,
      hoverIndex: null,
      dragType: 'resize',
      resizeSide: side,
    }
  }

  function onDragMove(index: number) {
    if (dragState.value.dragType === 'reorder') {
      dragState.value.hoverIndex = index
    }
  }

  function onDragEnd() {
    if (
      dragState.value.isDragging &&
      dragState.value.dragType === 'reorder' &&
      dragState.value.fromIndex !== null &&
      dragState.value.hoverIndex !== null &&
      dragState.value.fromIndex !== dragState.value.hoverIndex
    ) {
      store.reorderShot(dragState.value.fromIndex, dragState.value.hoverIndex)
    }
    dragState.value.isDragging = false
    dragState.value.fromIndex = null
    dragState.value.hoverIndex = null
    dragState.value.dragType = null
  }

  function onResize(index: number, deltaMs: number) {
    const currentDuration = store.state.timeline[index]?.duration ?? 2
    const newDuration = currentDuration + deltaMs
    store.updateShotDuration(index, newDuration)
  }

  function onScrub(clientX: number, timelineWidth: number) {
    const ratio = clientX / timelineWidth
    store.seekTo(ratio * totalDuration.value)
  }

  function splitShot(index: number, splitTime: number) {
    const shot = store.state.timeline[index]
    if (!shot || shot.duration <= 1) return

    const leftDuration = splitTime
    const rightDuration = shot.duration - splitTime

    const leftShot: TimelineShot = { ...shot, id: `${shot.id}_a`, index, duration: leftDuration }
    const rightShot: TimelineShot = { ...shot, id: `${shot.id}_b`, index: index + 1, duration: rightDuration }

    const newTimeline = [...store.state.timeline]
    newTimeline.splice(index, 1, leftShot, rightShot)
    // 重编号
    store.state.timeline = newTimeline.map((s, i) => ({ ...s, index: i }))
  }

  function mergeShots(indexA: number, indexB: number) {
    if (Math.abs(indexA - indexB) !== 1) return
    const first = Math.min(indexA, indexB)
    const second = Math.max(indexA, indexB)
    const shotA = store.state.timeline[first]
    const shotB = store.state.timeline[second]
    if (!shotA || !shotB) return

    const merged: TimelineShot = {
      ...shotA,
      id: `${shotA.id}_${shotB.id}`,
      description: `${shotA.description}; ${shotB.description}`,
      duration: shotA.duration + shotB.duration,
    }

    const newTimeline = [...store.state.timeline]
    newTimeline.splice(first, 2, merged)
    store.state.timeline = newTimeline.map((s, i) => ({ ...s, index: i }))
  }

  return {
    dragState,
    shotPositions,
    totalDuration,
    startDrag,
    startResize,
    onDragMove,
    onDragEnd,
    onResize,
    onScrub,
    splitShot,
    mergeShots,
  }
}
