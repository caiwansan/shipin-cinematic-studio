// ============================================================
// compileShotGraph.ts — ShotGraph Compiler
// Phase 3: IRBeat → ShotNode（导演级镜头语言）
//
// 流程：NarrativeIR → ShotGraphCompiler → ShotGraph
//
// 关键设计：
// - IR 不动（NarrativeIR 保持 Canonical）
// - ShotGraph 可独立运行（不依赖 IR 结构，只消费 beat）
// - camera movement 由 Intent Graph 驱动
// ============================================================

import { v4 as uuid } from 'uuid'
import type { NarrativeIR, IRBeat, CameraIntent, IRIntentNode } from '../../types/narrative/ir/NarrativeIR.js'
import type {
  ShotGraph,
  ShotNode,
  ShotTransition,
  CameraType,
  CameraMovement,
  FramingStyle,
  LightingMood,
  TransitionType,
} from '../../types/cinematic/ShotGraph.js'
import { narrativeGateway } from '../../runtime/narrative-gateway.js'

// ─── 常量 ─────────────────────────────────────────────
const DEFAULT_BEAT_DURATION_S = 2       // 每 beat 默认 2 秒
const MIN_SHOT_DURATION_S = 0.5         // 最小镜头 0.5 秒
const MAX_SHOT_DURATION_S = 8           // 最大镜头 8 秒

// ─── CameraIntent → Camera + Composition 映射规则 ───
// 纯 deterministic 映射（可调 LLM 增强，但核心规则固定）

interface CameraMapping {
  cameraType: CameraType
  movement: CameraMovement
  intensity: number
  framing: FramingStyle
  depth: number
  lightingMood: LightingMood
}

const CAMERA_INTENT_MAP: Record<CameraIntent, CameraMapping> = {
  'slow-push-in': {
    cameraType: 'closeup',
    movement: 'push-in',
    intensity: 0.3,
    framing: 'center',
    depth: 0.2,
    lightingMood: 'low-key',
  },
  'handheld-instability': {
    cameraType: 'medium',
    movement: 'handheld-shake',
    intensity: 0.7,
    framing: 'dutch-angle',
    depth: 0.4,
    lightingMood: 'chiaroscuro',
  },
  'static-tension-framing': {
    cameraType: 'wide',
    movement: 'static',
    intensity: 0.1,
    framing: 'symmetrical',
    depth: 0.8,
    lightingMood: 'low-key',
  },
  'dolly-zoom': {
    cameraType: 'closeup',
    movement: 'dolly-zoom',
    intensity: 0.9,
    framing: 'center',
    depth: 0.3,
    lightingMood: 'high-key',
  },
  'wide-establishing': {
    cameraType: 'extreme-wide',
    movement: 'static',
    intensity: 0.1,
    framing: 'rule-of-thirds',
    depth: 1.0,
    lightingMood: 'natural',
  },
  'close-up-reveal': {
    cameraType: 'closeup',
    movement: 'push-in',
    intensity: 0.5,
    framing: 'center',
    depth: 0.1,
    lightingMood: 'high-key',
  },
  'over-the-shoulder': {
    cameraType: 'medium',
    movement: 'static',
    intensity: 0.2,
    framing: 'frame-within-frame',
    depth: 0.3,
    lightingMood: 'natural',
  },
  'tracking-follow': {
    cameraType: 'medium',
    movement: 'tracking',
    intensity: 0.4,
    framing: 'leading-lines',
    depth: 0.5,
    lightingMood: 'natural',
  },
  'aerial-establishing': {
    cameraType: 'extreme-wide',
    movement: 'crane-down',
    intensity: 0.3,
    framing: 'negative-space',
    depth: 1.0,
    lightingMood: 'golden-hour',
  },
  'low-angle-power': {
    cameraType: 'dutch',
    movement: 'tilt',
    intensity: 0.4,
    framing: 'symmetrical',
    depth: 0.6,
    lightingMood: 'high-key',
  },
  'high-angle-vulnerability': {
    cameraType: 'wide',
    movement: 'crane-up',
    intensity: 0.3,
    framing: 'negative-space',
    depth: 0.7,
    lightingMood: 'overcast',
  },
  'dutch-angle-instability': {
    cameraType: 'dutch',
    movement: 'handheld-shake',
    intensity: 0.8,
    framing: 'dutch-angle',
    depth: 0.3,
    lightingMood: 'neon-noir',
  },
  'panscan-discover': {
    cameraType: 'wide',
    movement: 'pan',
    intensity: 0.3,
    framing: 'leading-lines',
    depth: 0.9,
    lightingMood: 'natural',
  },
  'steady-contemplation': {
    cameraType: 'medium',
    movement: 'static',
    intensity: 0.1,
    framing: 'rule-of-thirds',
    depth: 0.5,
    lightingMood: 'golden-hour',
  },
  'rapid-cut-action': {
    cameraType: 'closeup',
    movement: 'handheld-shake',
    intensity: 0.9,
    framing: 'dutch-angle',
    depth: 0.2,
    lightingMood: 'high-key',
  },
}

// ─── 辅助函数 ─────────────────────────────────────────

function getDefaultMapping(): CameraMapping {
  return CAMERA_INTENT_MAP['steady-contemplation']
}

function getIntentWeightAtBeat(
  intents: IRIntentNode[],
  beatId: string,
): number {
  // 找到以这个 beat 为 target 的意图，取最大权重
  const relevant = intents.filter(i => i.targetBeatId === beatId)
  if (relevant.length === 0) return 0.5
  return Math.max(...relevant.map(i => i.weight))
}

function inferShotDuration(
  beat: IRBeat,
  prevBeat: IRBeat | undefined,
  nextBeat: IRBeat | undefined,
  intentWeight: number,
): number {
  let duration = DEFAULT_BEAT_DURATION_S

  // 根据 cameraIntent 调整
  if (beat.cameraIntent === 'rapid-cut-action') duration = 0.8
  else if (beat.cameraIntent === 'steady-contemplation') duration = 4
  else if (beat.cameraIntent === 'wide-establishing') duration = 3
  else if (beat.cameraIntent === 'aerial-establishing') duration = 5

  // 高意图权重 → 更短镜头（紧张感）
  if (intentWeight > 0.8) duration *= 0.7
  else if (intentWeight < 0.3) duration *= 1.3

  // clamp
  return Math.max(MIN_SHOT_DURATION_S, Math.min(MAX_SHOT_DURATION_S, duration))
}

function inferTransitionType(
  currMovement: CameraMovement,
  nextMovement: CameraMovement,
  intentPolarity: number,
): TransitionType {
  if (intentPolarity === -1) return 'smash-cut'
  if (currMovement === 'static' && nextMovement === 'static') return 'cut'
  if (currMovement === 'handheld-shake') return 'jump-cut'
  if (currMovement === 'push-in') return 'match-cut'
  return 'crossfade'
}

function computeHistogram(shots: ShotNode[]): ShotGraph['meta'] {
  const totalDuration = shots.reduce((s, n) => s + n.timing.duration, 0)
  const movementHist: Record<string, number> = {}
  const lightHist: Record<string, number> = {}

  for (const s of shots) {
    movementHist[s.camera.movement] = (movementHist[s.camera.movement] || 0) + 1
    lightHist[s.lighting.mood] = (lightHist[s.lighting.mood] || 0) + 1
  }

  return {
    totalDuration: Math.round(totalDuration * 10) / 10,
    shotCount: shots.length,
    avgShotDuration: shots.length > 0 ? Math.round((totalDuration / shots.length) * 10) / 10 : 0,
    cameraMovementHistogram: movementHist as any,
    lightingDistribution: lightHist as any,
  }
}

// ─── 主入口 ──────────────────────────────────────────

/**
 * compileShotGraph: 从 NarrativeIR 生成 ShotGraph
 *
 * 核心映射规则：
 * 1. IRBeat.cameraIntent → 确定性 CameraMapping（CAMERA_INTENT_MAP）
 * 2. Intent Graph 权重影响 shot duration
 * 3. 过渡类型由相邻镜头的 movement 差异 + intent polarity 决定
 *
 * 可独立运行：输入 IR，输出 ShotGraph，无外部依赖
 */
export async function compileShotGraph(ir: NarrativeIR): Promise<ShotGraph> {
  const shotGraphId = uuid()
  const shots: ShotNode[] = []
  const transitions: ShotTransition[] = []

  // 遍历所有 segments → beats
  for (const segment of ir.segments) {
    // 收集该 segment 的 intent nodes（用于驱动）
    const segmentBeatIds = new Set(segment.beats.map(b => b.t.toString()))

    for (let bi = 0; bi < segment.beats.length; bi++) {
      const beat = segment.beats[bi]
      const beatId = `${segment.id}-beat-${bi}`
      const prevBeat = bi > 0 ? segment.beats[bi - 1] : undefined
      const nextBeat = bi < segment.beats.length - 1 ? segment.beats[bi + 1] : undefined

      // Step 1: CameraIntent → 映射
      const mapping = CAMERA_INTENT_MAP[beat.cameraIntent] || getDefaultMapping()

      // Step 2: Intent weight → duration 调整
      const intentWeight = getIntentWeightAtBeat(ir.graph.nodes, beatId)
      const shotDuration = inferShotDuration(beat, prevBeat, nextBeat, intentWeight)

      // Step 3: 构建 ShotNode
      const shot: ShotNode = {
        id: `${shotGraphId}-shot-${shots.length}`,
        sourceBeatId: beatId,
        segmentId: segment.id,
        camera: {
          type: mapping.cameraType,
          movement: mapping.movement,
          intensity: Math.round(mapping.intensity * 100) / 100,
        },
        composition: {
          framing: mapping.framing,
          focus: beat.visualHint || 'scene-focus',
          depth: mapping.depth,
        },
        lighting: {
          mood: mapping.lightingMood,
          contrast: intentWeight > 0.7 ? 0.8 : 0.4,
          colorTint: beat.emotion.includes('fear') || beat.emotion.includes('sad') ? 'cool' : 'warm',
        },
        timing: {
          duration: Math.round(shotDuration * 10) / 10,
          inPoint: beat.t,
          outPoint: beat.t + Math.round(shotDuration * 1000),
          pacing: shotDuration < 1.5 ? 'fast' : shotDuration > 3 ? 'slow' : 'medium',
        },
        emotionColor: beat.emotion,
      }

      shots.push(shot)
    }
  }

  // Step 4: 构建 transitions
  for (let si = 0; si < shots.length - 1; si++) {
    const curr = shots[si]
    const next = shots[si + 1]

    // 找到跨越这两个 shot 的 intent
    const crossIntent = ir.graph.nodes.find(n =>
      n.targetBeatId === next.sourceBeatId &&
      n.sourceBeatId === curr.sourceBeatId,
    )
    const polarity = crossIntent?.polarity || 1

    const transition: ShotTransition = {
      fromShotId: curr.id,
      toShotId: next.id,
      type: inferTransitionType(curr.camera.movement, next.camera.movement, polarity),
      duration: polarity === -1 ? 0.1 : 0.3,
      narrativePurpose: crossIntent?.type
        ? `${crossIntent.type}-transition`
        : 'narrative-flow',
    }

    transitions.push(transition)
  }

  const shotGraph: ShotGraph = {
    id: shotGraphId,
    projectId: ir.projectId,
    shots,
    transitions,
    entryShotId: shots[0]?.id || '',
    meta: computeHistogram(shots),
  }

  return shotGraph
}
