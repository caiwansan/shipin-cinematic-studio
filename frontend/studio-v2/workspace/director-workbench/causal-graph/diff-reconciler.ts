/**
 * Diff-based Reconciler
 * 差异合并器 — 将因果图的 patch set 映射为 UI 可消费的变更集
 *
 * 核心哲学：
 *   不是全量 re-render，而是 patch diff
 *   只更新变化的部分，保留未变的内容
 *
 * 输入：CausalPatch[]
 * 输出：针对 TimelineTrack / ShotGraphView / EmotionArc / MotionOverlay 的增量更新
 */

export type CausalPatch = {
  type: 'ADD_NODE' | 'REMOVE_NODE' | 'UPDATE_NODE' | 'ADD_EDGE' | 'REMOVE_EDGE' | 'UPDATE_EDGE'
  nodeId?: string
  edgeId?: string
  node?: any
  edge?: any
  oldState?: Record<string, any>
  newState?: Record<string, any>
}

// ─── UI 层差异类型 ─────────────────────────────────

export interface TimelineDiff {
  shotIndex: number
  type: 'add' | 'remove' | 'update'
  shot: any | null
  changes?: string[]
}

export interface GraphDiff {
  nodeId: string
  type: 'add' | 'remove' | 'update'
  layer: string
  changes?: string[]
}

export interface EmotionDiff {
  shotIndex: number
  type: 'update'
  tension?: number
  mood?: string
}

export interface MotionDiff {
  shotIndex: number
  type: 'update'
  motionStyle?: string
  pressure?: number
  instability?: number
}

export interface UIPatchSet {
  timeline: TimelineDiff[]
  graph: GraphDiff[]
  emotion: EmotionDiff[]
  motion: MotionDiff[]
  shouldRerender: boolean // 是否需要完全重渲染
}

/**
 * 将因果图 patches 转换为 UI diff set
 */
export function reconcilePatches(
  patches: CausalPatch[],
  currentTimeline: any[],
): UIPatchSet {
  const result: UIPatchSet = {
    timeline: [],
    graph: [],
    emotion: [],
    motion: [],
    shouldRerender: false,
  }

  for (const patch of patches) {
    switch (patch.type) {
      case 'UPDATE_NODE':
        processUpdateNode(patch, result, currentTimeline)
        break
      case 'ADD_NODE':
        processAddNode(patch, result)
        break
      case 'REMOVE_NODE':
        processRemoveNode(patch, result)
        break
      default:
        // ADD_EDGE / REMOVE_EDGE / UPDATE_EDGE → graph re-render 需要
        result.shouldRerender = true
        break
    }
  }

  return result
}

function processUpdateNode(
  patch: CausalPatch,
  result: UIPatchSet,
  currentTimeline: any[],
): void {
  if (!patch.nodeId || !patch.newState) return

  const parts = patch.nodeId.split('_')
  const layer = parts[1] ?? ''
  const shotIndex = parseInt(parts[0], 10)
  if (isNaN(shotIndex)) return

  const changes: string[] = []

  // 计算实际变化的字段
  for (const [key, value] of Object.entries(patch.newState)) {
    if (patch.oldState?.[key] !== value) {
      changes.push(key)
    }
  }

  switch (layer) {
    case 'shot':
      result.timeline.push({
        shotIndex,
        type: 'update',
        shot: patch.newState,
        changes,
      })
      break

    case 'grammar': {
      if (patch.newState.grammarType && patch.newState.grammarType !== patch.oldState?.grammarType) {
        result.timeline.push({
          shotIndex,
          type: 'update',
          shot: { grammarType: patch.newState.grammarType },
          changes: ['grammarType'],
        })
        result.graph.push({
          nodeId: patch.nodeId,
          type: 'update',
          layer,
          changes: ['grammarType'],
        })
      }
      break
    }

    case 'motion': {
      const motionKeys = ['motionStyle', 'pressure', 'instability', 'energyFlow']
      const motionChanges = changes.filter(k => motionKeys.includes(k))
      if (motionChanges.length > 0) {
        result.motion.push({
          shotIndex,
          type: 'update',
          motionStyle: patch.newState.motionStyle ?? patch.oldState?.motionStyle,
          pressure: patch.newState.pressure ?? patch.oldState?.pressure,
          instability: patch.newState.instability ?? patch.oldState?.instability,
        })
        result.timeline.push({
          shotIndex,
          type: 'update',
          shot: {
            motionStyle: patch.newState.motionStyle,
            motionPressure: patch.newState.pressure,
            motionInstability: patch.newState.instability,
            motionEnergyFlow: patch.newState.energyFlow,
          },
          changes: motionChanges,
        })
      }
      break
    }

    case 'emotion': {
      const emotionChanges: string[] = []
      if (patch.newState.tension !== patch.oldState?.tension) emotionChanges.push('tension')
      if (patch.newState.mood !== patch.oldState?.mood) emotionChanges.push('mood')
      if (emotionChanges.length > 0) {
        result.emotion.push({
          shotIndex,
          type: 'update',
          tension: patch.newState.tension,
          mood: patch.newState.mood,
        })
        emotionChanges.forEach(c => changes.push(c))
      }
      break
    }

    case 'character': {
      result.shouldRerender = true
      break
    }

    default:
      break
  }
}

function processAddNode(
  patch: CausalPatch,
  result: UIPatchSet,
): void {
  result.timeline.push({
    shotIndex: 0,
    type: 'add',
    shot: patch.node,
  })
  result.shouldRerender = true
}

function processRemoveNode(
  patch: CausalPatch,
  result: UIPatchSet,
): void {
  const parts = patch.nodeId?.split('_') ?? []
  const shotIndex = parseInt(parts[0], 10)
  if (!isNaN(shotIndex)) {
    result.timeline.push({
      shotIndex,
      type: 'remove',
      shot: null,
    })
  }
  result.shouldRerender = true
}

/**
 * 将 UI patch set 应用到传入的 store/timeline 数据
 * 返回更新后的 timeline（immutable update）
 */
export function applyPatchesToTimeline(
  timeline: any[],
  patches: UIPatchSet,
): any[] {
  const updated = [...timeline]

  for (const diff of patches.timeline) {
    switch (diff.type) {
      case 'update': {
        if (updated[diff.shotIndex]) {
          updated[diff.shotIndex] = {
            ...updated[diff.shotIndex],
            ...diff.shot,
          }
        }
        break
      }
      case 'add': {
        if (diff.shot) {
          updated.push(diff.shot)
        }
        break
      }
      case 'remove': {
        if (diff.shotIndex < updated.length) {
          updated.splice(diff.shotIndex, 1)
        }
        break
      }
    }
  }

  return updated
}

/**
 * 检查 patch set 是否为空（没有实际变化）
 */
export function isEmptyPatchSet(patches: UIPatchSet): boolean {
  return (
    patches.timeline.length === 0 &&
    patches.graph.length === 0 &&
    patches.emotion.length === 0 &&
    patches.motion.length === 0 &&
    !patches.shouldRerender
  )
}
