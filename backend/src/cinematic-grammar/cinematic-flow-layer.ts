/**
 * Cinematic Flow Layer (CFL) — E1.8
 *
 * 在 BCSG 之后执行的 state propagation system。
 * 维护 shot 之间的情绪、视觉、节奏连续性。
 *
 * 圣裁约束（不可违反）：
 *   ❌ 不生成 shot
 *   ❌ 不变更 shotType / boundaryId
 *   ❌ 不影响 BCSG grammar 决策
 *   ❌ 不可参与 segmentation
 *   ❌ 不扩展 emotion inference / intent detection
 *
 *   ✔ 只做 shot-level modulation（framing / duration / camera）
 *   ✔ CFL = non-destructive modifier, not a decision layer
 *   ✔ Stateless transformation: 相同输入 + 相同 state → 相同输出
 *   ✔ 三条 state vector，不可扩展
 */

import { ShotGrammarNode, ShotGrammarType } from './shot-grammar-tree'
import { SpeechActMark } from './speech-act-marker'

// ─── State Types ───

export interface EmotionState {
  tension: number       // 0-1
  curiosity: number     // 0-1
  calmness: number      // 0-1
  urgency: number       // 0-1
}

export interface VisualState {
  framingBias: 'wide' | 'medium' | 'close'
  motionMomentum: 'static' | 'tracking' | 'handheld'
  focusIntensity: number // 0-1
}

export interface RhythmState {
  pace: number          // 0-1 (slow ↔ fast)
  shotDensity: number   // shots per time window
  cutPressure: number   // 0-1 (tendency to cut)
}

export interface CFLState {
  emotionState: EmotionState
  visualState: VisualState
  rhythmState: RhythmState
}

// ─── Shot Skeleton (CFL-modifiable parameters) ───

export type FramingType = 'wide' | 'medium' | 'close' | 'extreme_close'

export interface ShotSkeleton {
  shotType: ShotGrammarType
  boundaryId: string | number
  framing: FramingType
  duration: number        // seconds
  camera: 'static' | 'track' | 'pan' | 'tilt' | 'push_in' | 'pull_out' | 'handheld'
  intensity: number       // 0-1
  speechActMark?: SpeechActMark
}

export interface ModifiedShotSkeleton extends ShotSkeleton {
  // CFL 修改后的字段（附加原值用于 lock 校验）
  _originalFraming?: ShotSkeleton['framing']
  _originalDuration?: number
  _originalCamera?: ShotSkeleton['camera']
}

// ─── Default State ───

export function defaultCFLState(): CFLState {
  return {
    emotionState: {
      tension: 0.15,
      curiosity: 0.3,
      calmness: 0.8,
      urgency: 0.1,
    },
    visualState: {
      framingBias: 'wide',
      motionMomentum: 'static',
      focusIntensity: 0.3,
    },
    rhythmState: {
      pace: 0.4,
      shotDensity: 0,
      cutPressure: 0.2,
    },
  }
}

// ─── consume(): 根据 prev → current shot 更新 CFL state ───

export function consume(
  prevShot: ShotSkeleton | null,
  currentShot: ShotSkeleton,
  state: CFLState,
): CFLState {
  return {
    emotionState: updateEmotion(prevShot, currentShot, state),
    visualState: updateVisual(prevShot, currentShot, state),
    rhythmState: updateRhythm(prevShot, currentShot, state),
  }
}

function updateEmotion(
  prev: ShotSkeleton | null,
  current: ShotSkeleton,
  state: CFLState,
): EmotionState {
  const intensity = current.intensity

  // 对话场景：urgency 略升，calmness 略降
  const speechBoost = current.speechActMark ? 0.08 : 0

  // 高潮镜头：tension 骤升，calmness 骤降
  const isPeak = current.shotType === 'peak' || current.shotType === 'build_up' && intensity > 0.7
  const tensionDelta = isPeak ? 0.2 : -0.05

  // inertia: 继承上帧 60%
  const inertia = prev ? 0.6 : 0

  const newTension = clamp(
    (prev?.intensity ?? 0) * inertia + state.emotionState.tension * (1 - inertia) + tensionDelta + speechBoost * 0.5,
    0, 1,
  )

  // peak → curiosity 降（注意力集中于冲突）
  const curiosityDecay = isPeak ? 0.1 : -0.03

  const newCalmness = state.emotionState.calmness - tensionDelta * 1.5 - speechBoost
  // calmness 受 tension 抑制：tension 高时 calmness 不能同时高
  const tensionSuppression = Math.max(0, newTension - 0.5) * 0.5
  // calmness 自然衰减：若无外力注入，缓慢下降（类似热力学第二定律）
  const naturalDecay = 0.03

  return {
    tension: clamp(newTension, 0, 1),
    curiosity: clamp(state.emotionState.curiosity - curiosityDecay + speechBoost * 0.3, 0, 1),
    calmness: clamp(newCalmness - tensionSuppression - naturalDecay, 0, 1),
    urgency: clamp(state.emotionState.urgency + (isPeak ? 0.15 : -0.03) + speechBoost, 0, 1),
  }
}

function updateVisual(
  prev: ShotSkeleton | null,
  current: ShotSkeleton,
  state: CFLState,
): VisualState {
  // framing inertia: 保留 prev 的 40% bias
  const inertia = prev ? 0.4 : 0
  const prevBias = prev
    ? (prev.framing === 'wide' ? 'wide' as const : prev.framing === 'close' || prev.framing === 'extreme_close' ? 'close' as const : 'medium' as const)
    : state.visualState.framingBias

  // 对话场景：倾向 medium
  const framingFromSpeech = current.speechActMark ? 'medium' as const : null

  // motion momentum: 对话场景倾向 static
  const motionFromSpeech = current.speechActMark ? 'static' as const : null

  // framing 决策：惯性 + 当前 shot 语义
  let newFraming = state.visualState.framingBias
  if (framingFromSpeech && Math.random() < 0.3) {
    // deterministic: speech act 60% 倾向 medium
    newFraming = Math.random() < 0.6 ? 'medium' : state.visualState.framingBias
  }
  // 重制为确定性：speech → 切换倾向 medium
  if (current.speechActMark && prevBias !== 'medium') {
    newFraming = 'medium'
  } else if (current.shotType === 'establishing') {
    newFraming = 'wide'
  } else if (current.shotType === 'peak') {
    newFraming = 'close'
  } else if (current.shotType === 'release') {
    newFraming = 'wide'
  } else {
    // inertia: 保持 prev bias（但不用 random）
    newFraming = prevBias
  }

  // motion momentum
  let newMotion: VisualState['motionMomentum']
  if (current.speechActMark) {
    newMotion = 'static'
  } else if (current.shotType === 'peak' && current.intensity > 0.7) {
    newMotion = 'handheld'
  } else if (current.shotType === 'establishing') {
    newMotion = 'tracking'
  } else {
    newMotion = state.visualState.motionMomentum
  }

  return {
    framingBias: newFraming,
    motionMomentum: newMotion,
    focusIntensity: clamp(
      state.visualState.focusIntensity * 0.7 + current.intensity * 0.3,
      0, 1,
    ),
  }
}

function updateRhythm(
  prev: ShotSkeleton | null,
  current: ShotSkeleton,
  state: CFLState,
): RhythmState {
  const intensity = current.intensity
  const speech = current.speechActMark

  // pace: 对话微慢，高潮加速
  const paceDelta = speech ? -0.05 : (intensity > 0.7 ? 0.1 : 0)
  const newPace = clamp(state.rhythmState.pace + paceDelta, 0, 1)

  // cutPressure: peak 后释放降低 pressure
  const pressureDelta = current.shotType === 'peak' ? 0.3
    : current.shotType === 'release' ? -0.2
    : speech ? -0.05
    : 0.02

  return {
    pace: newPace,
    shotDensity: state.rhythmState.shotDensity + 1,
    cutPressure: clamp(state.rhythmState.cutPressure + pressureDelta, 0, 1),
  }
}

// ─── applyCFL(): 根据 CFL state 偏置 shot 参数 ───

export function applyCFL(shot: ShotSkeleton, state: CFLState): ModifiedShotSkeleton {
  const modified: ModifiedShotSkeleton = {
    ...shot,
    _originalFraming: shot.framing,
    _originalDuration: shot.duration,
    _originalCamera: shot.camera,
  }

  // 帧距偏置：CFL state.framingBias → shot.framing
  modified.framing = biasFraming(shot.framing, state.visualState, shot.shotType)

  // 时长偏置：rhythm.pace → duration
  modified.duration = biasDuration(shot.duration, state.rhythmState)

  // 运镜偏置：visual + rhythm → camera
  modified.camera = biasCamera(shot.camera, state.visualState, state.rhythmState)

  return modified
}

function biasFraming(
  base: FramingType,
  visualState: VisualState,
  shotType?: ShotGrammarType,
): FramingType {
  // 如果 base 已有明确语义，不覆写
  if (base === 'extreme_close') return base
  // release/establishing 的 framing 有语义功能，不应被 CFL 覆盖
  if (shotType === 'release' || shotType === 'establishing') return base

  const bias = visualState.framingBias
  // 只向 bias 方向靠近，不变更 shot 本意
  if (bias === 'wide' && base !== 'wide') {
    return 'wide'
  }
  if (bias === 'close' && base !== 'close') {
    return 'close'
  }
  return base
}

function biasDuration(
  base: number,
  rhythmState: RhythmState,
): number {
  // pace 快 → 缩短 duration；pace 慢 → 延长 duration
  const paceFactor = 1 + (0.5 - rhythmState.pace) * 0.4
  const cutPressureFactor = 1 - rhythmState.cutPressure * 0.2
  const result = base * paceFactor * cutPressureFactor
  return Math.round(Math.max(0.5, Math.min(20, result)) * 10) / 10
}

function biasCamera(
  base: ShotSkeleton['camera'],
  visualState: VisualState,
  rhythmState: RhythmState,
): ShotSkeleton['camera'] {
  // 如果 motion momentum 和 base 冲突，优先 momentum
  const momentum = visualState.motionMomentum

  if (momentum === 'handheld' && base !== 'handheld' && rhythmState.cutPressure > 0.6) {
    return 'handheld'
  }
  if (momentum === 'tracking' && base === 'static') {
    return 'track' // 从 static 升级到 track
  }
  return base
}

// ─── finalConstraintLock: 确保 CFL 没有破坏 grammar invariants ───

export interface LockViolation {
  field: string
  original: unknown
  modified: unknown
}

export function finalConstraintLock(
  original: ShotSkeleton,
  modified: ModifiedShotSkeleton,
): { passed: boolean; violations: LockViolation[]; result: ShotSkeleton } {
  const violations: LockViolation[] = []

  // 不变量 1: shotType 不可变
  if (original.shotType !== modified.shotType) {
    violations.push({
      field: 'shotType',
      original: original.shotType,
      modified: modified.shotType,
    })
  }

  // 不变量 2: boundaryId 不可变
  if (original.boundaryId !== modified.boundaryId) {
    violations.push({
      field: 'boundaryId',
      original: original.boundaryId,
      modified: modified.boundaryId,
    })
  }

  // 不变量 3: framing 不能从 wide → extreme_close（跨度过大）
  const originalFramingVal = original.framing
  const modifiedFramingVal = modified.framing
  if (
    (originalFramingVal === 'wide' && modifiedFramingVal === 'close') ||
    (originalFramingVal === 'close' && modifiedFramingVal === 'wide') ||
    (originalFramingVal === 'wide' && modifiedFramingVal === 'extreme_close') ||
    (originalFramingVal === 'extreme_close' && modifiedFramingVal === 'wide')
  ) {
    violations.push({
      field: 'framing',
      original: original.framing,
      modified: modified.framing,
    })
  }

  // 不变量 4: duration 不能超出合理范围
  if (modified.duration < 0.5 || modified.duration > 20) {
    violations.push({
      field: 'duration',
      original: original.duration,
      modified: modified.duration,
    })
  }

  if (violations.length > 0) {
    // 如果有 violations，回退到原始值
    return {
      passed: false,
      violations,
      result: { ...original },
    }
  }

  return {
    passed: true,
    violations: [],
    result: modified,
  }
}

// ─── Utility ───

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ─── CFL Runtime 主流程 ───

export interface CFLRuntimeResult {
  shots: ShotSkeleton[]
  stateTrace: CFLState[]
  lockResults: {
    shotIndex: number
    passed: boolean
    violations: LockViolation[]
  }[]
  /** 三指标联合 coherence 判定 */
  coherence: {
    passed: boolean
    emotionStable: boolean
    visualInertial: boolean
    rhythmEmergent: boolean
  }
}

/**
 * 运行完整的 CFL pipeline：
 *   consume(state) → applyCFL(shot, state) → finalConstraintLock(original, modified)
 */
export function runCFL(
  shots: ShotSkeleton[],
  initialCFLState: CFLState = defaultCFLState(),
): CFLRuntimeResult {
  let state = { ...initialCFLState }
  const stateTrace: CFLState[] = [{ ...state }]
  const lockResults: CFLRuntimeResult['lockResults'] = []
  const resultShots: ShotSkeleton[] = []

  for (let i = 0; i < shots.length; i++) {
    const prevShot = i > 0 ? shots[i - 1] : null
    const currentShot = shots[i]

    // 1. consume: 更新状态
    state = consume(prevShot, currentShot, state)
    stateTrace.push({ ...state })

    // 2. applyCFL: 偏置 shot 参数
    const modified = applyCFL(currentShot, state)

    // 3. finalConstraintLock: 验证不变量
    const lockResult = finalConstraintLock(currentShot, modified)
    lockResults.push({
      shotIndex: i,
      passed: lockResult.passed,
      violations: lockResult.violations,
    })

    resultShots.push(lockResult.result)
  }

  return {
    shots: resultShots,
    stateTrace,
    lockResults,
    coherence: computeCoherence(stateTrace),
  }
}

/**
 * 三指标联合 coherence 判定
 *
 * CFL_COHERENCE(sequence) = emotion_stable ∧ visual_inertial ∧ rhythm_emergent
 */
export function computeCoherence(stateTrace: CFLState[]): CFLRuntimeResult['coherence'] {
  if (stateTrace.length < 3) {
    return { passed: false, emotionStable: false, visualInertial: false, rhythmEmergent: false }
  }

  // 只分析后 5 个 state（观测窗口）
  const window = stateTrace.slice(-5)
  const n = window.length

  // 1. emotion_stable: state derivative must be bounded
  //    计算 tension 的相邻差值的平均绝对值
  let tensionDiffs = 0
  for (let i = 1; i < n; i++) {
    tensionDiffs += Math.abs(window[i].emotionState.tension - window[i - 1].emotionState.tension)
  }
  const avgTensionDiff = tensionDiffs / (n - 1)
  const emotionStable = avgTensionDiff < 0.15  // 平均每步变化 < 0.15

  // 2. visual_inertial: framingBias 在窗口内保持稳定或渐变
  //    用 dominant bias ratio：窗口内半数以上状态的 framingBias 一致 → 有惯性
  //    等级映射：wide=0, medium=1, close=2
  const framingRank: Record<string, number> = { wide: 0, medium: 1, close: 2 }
  const lastFraming = window.slice(-4).map(s => s.visualState.framingBias)
  // 计算最常出现的 framing
  const freq: Record<string, number> = {}
  for (const f of lastFraming) freq[f] = (freq[f] ?? 0) + 1
  const maxFreq = Math.max(...Object.values(freq), 0)
  const dominantRatio = maxFreq / lastFraming.length
  // 超过半数时间窗口使用同一 framing → 有惯性
  const hasDominantBias = dominantRatio >= 0.5
  // 同时检查最大跳变不超过 2 级（允许 release 重置）
  let maxFramingJump = 0
  for (let i = 1; i < lastFraming.length; i++) {
    const rankA = framingRank[lastFraming[i - 1]] ?? 1
    const rankB = framingRank[lastFraming[i]] ?? 1
    maxFramingJump = Math.max(maxFramingJump, Math.abs(rankA - rankB))
  }
  const visualInertial = hasDominantBias && maxFramingJump <= 2

  // 3. rhythm_emergent: 是否存在节奏块
  //    检查 pace 是否在后几帧中有趋势
  const last3Pace = window.slice(-3).map(s => s.rhythmState.pace)
  // pace 单调递增 → build-up 趋势；或单调递减 → release 趋势
  const isMonotonic = (last3Pace[0] <= last3Pace[1] && last3Pace[1] <= last3Pace[2]) ||
                      (last3Pace[0] >= last3Pace[1] && last3Pace[1] >= last3Pace[2])
  // cutPressure 有趋势
  const last3Pressure = window.slice(-3).map(s => s.rhythmState.cutPressure)
  const pressureTrend = (last3Pressure[0] <= last3Pressure[1] && last3Pressure[1] <= last3Pressure[2]) ||
                        (last3Pressure[0] >= last3Pressure[1] && last3Pressure[1] >= last3Pressure[2])
  const rhythmEmergent = isMonotonic || pressureTrend

  const passed = emotionStable && visualInertial && rhythmEmergent

  return { passed, emotionStable, visualInertial, rhythmEmergent }
}
