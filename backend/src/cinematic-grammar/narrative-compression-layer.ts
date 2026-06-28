/**
 * Narrative Compression Layer (NCL) — E1.8.1
 *
 * 位置：SAM → BCSG → [NCL] → CFL
 *
 * NCL 修复 BCSG 的 over-segmentation 问题。
 * BCSG 做 cut，NCL 做 merge。
 *
 * ─── 核心语义 ───
 * BCSG segment → IntentUnit → ShotSkeleton
 *
 * ─── merge 规则（顺序固定、deterministic、无 AI）───
 * 1. dialogue merge        — 连续 speech_act → 1 dialogue block
 * 2. scene coherence merge — 同 location + same participants → merge
 * 3. motion chain merge    — 连续 action/motion → 1 shot cluster
 * 4. emotion continuity    — emotion gradient smooth → 不拆
 *
 * ─── 圣裁 ───
 * ❌ 不得改 BCSG segmentation 逻辑
 * ❌ 不得让 CFL 参与 compression
 * ❌ 不得引入 AI/LLM scoring
 * ❌ 不得增加新的 semantic layer
 * ❌ NCL 只能做 merge，不做 generation
 *
 * IntentUnit → ShotSkeleton 关系：
 *   1 IntentUnit ≈ 1 canonical shot
 *   CFL 可在 ±0.5–1 shot 范围内 adjust density
 *   CFL 只看 IntentUnit[]，不看 raw segments / BCSG clauses / SAM tags
 */

import { ShotGrammarType } from './shot-grammar-tree'
import { SpeechActMark } from './speech-act-marker'
import { NarrativeSequencedShot } from './narrative-sequencer'

// ─── IntentUnit 类型 ───

export type IntentUnitType = 'dialogue' | 'action' | 'reaction' | 'mixed' | 'transition'

export interface IntentUnit {
  type: IntentUnitType
  /** 构成此 intent unit 的原始 BCSG segments */
  segments: NarrativeSequencedShot[]
  /** 合并后的 ShotGrammarType（取主导 segment 的类型） */
  shotType: ShotGrammarType
  /** 持续时长 hint（秒） */
  durationHint: number
  /** 合并后的 intensity（取各 segment intensity 的加权平均） */
  intensity: number
  /** 此 unit 是否包含 speech act */
  hasSpeechAct: boolean
  /** 主导 speaker（如有） */
  dominantSpeaker: string | null
  /** 视觉 cue：合并后的 framing 倾向 */
  framingHint: 'wide' | 'medium' | 'close'
  /** 相机运动 hint */
  cameraHint: 'static' | 'track' | 'pan' | 'handheld'
}

// ─── 核心压缩函数 ───

/**
 * 将 BCSG segments（NarrativeSequencedShot[]）压缩为 IntentUnit[]
 *
 * merge 顺序（圣裁锁死）：
 *   1. dialogue merge
 *   2. scene coherence merge
 *   3. motion chain merge
 *   4. emotion continuity merge
 */
export function compressToIntentUnits(segments: NarrativeSequencedShot[]): IntentUnit[] {
  if (segments.length === 0) return []

  // 先转为单 segment IntentUnit（每个 segment 自成一个 intent unit）
  let units: IntentUnit[] = segments.map(seg => ({
    type: inferIntentType(seg),
    segments: [seg],
    shotType: seg.grammarType,
    durationHint: 3.0,
    intensity: getIntensity(seg),
    hasSpeechAct: seg.speechActMark !== undefined,
    dominantSpeaker: seg.speechActMark?.speaker ?? null,
    framingHint: inferFraming(seg),
    cameraHint: 'static',
  }))

  // Round 1: dialogue merge
  units = mergeDialogue(units)

  // Round 2: scene coherence merge
  units = mergeSceneCoherence(units)

  // Round 3: motion chain merge
  units = mergeMotionChain(units)

  // Round 4: emotion continuity merge
  units = mergeEmotionContinuity(units)

  // 后处理：更新每个 unit 的融合属性
  units = finalizeUnits(units)

  return units
}

// ─── IntentUnit → ShotSkeleton ───

/**
 * 将 IntentUnit 转为 ShotSkeleton（CFL 输入）
 * CFL 只看这个输出，不看 raw segments
 */
export function intentUnitToSkeleton(unit: IntentUnit, index: number): ShotSkeletonShim {
  return {
    shotType: unit.shotType,
    boundaryId: `${unit.type}_${index}`,
    framing: unit.framingHint,
    duration: unit.durationHint,
    camera: unit.cameraHint,
    intensity: unit.intensity,
    speechActMark: unit.hasSpeechAct ? {
      type: 'speech_act' as const,
      speechType: 'dialogue' as const,
      speaker: unit.dominantSpeaker ?? '',
      polarity: 'assertion' as const,
      tone: 'neutral' as const,
      rawText: unit.segments[0]?.rawDescription ?? '',
    } : undefined,
  }
}

/** CFL ShotSkeleton 的兼容类型（只取 NCL→CFL 需要的字段） */
export interface ShotSkeletonShim {
  shotType: ShotGrammarType
  boundaryId: string | number
  framing: 'wide' | 'medium' | 'close' | 'extreme_close'
  duration: number
  camera: 'static' | 'track' | 'pan' | 'tilt' | 'push_in' | 'pull_out' | 'handheld'
  intensity: number
  speechActMark?: {
    type: 'speech_act'
    speechType: 'dialogue'
    speaker: string
    polarity: 'assertion' | 'question' | 'answer'
    tone: string
    rawText: string
  }
}

// ─── Round 1: Dialogue Merge ───

/**
 * 合并连续 speech_act segments 为 1 个 dialogue block
 * 规则：连续 2+ 个 segment 含有 speechActMark → 合并
 */
function mergeDialogue(units: IntentUnit[]): IntentUnit[] {
  const result: IntentUnit[] = []
  let i = 0

  while (i < units.length) {
    if (units[i].hasSpeechAct) {
      // 找连续 speech act
      const dialogueGroup: IntentUnit[] = [units[i]]
      let j = i + 1
      while (j < units.length && units[j].hasSpeechAct) {
        dialogueGroup.push(units[j])
        j++
      }

      if (dialogueGroup.length >= 2) {
        // 合并为 1 个 dialogue block
        const merged = mergeUnitGroup(dialogueGroup, 'dialogue')
        // speech act chain 的 shotType 取 reaction
        merged.shotType = 'reaction'
        result.push(merged)
      } else {
        result.push(units[i])
      }

      i = j
    } else {
      result.push(units[i])
      i++
    }
  }

  return result
}

// ─── Round 2: Scene Coherence Merge ───

/**
 * 合并同 space + same participants 的 segments
 * 使用启发式标记而非语义理解：
 *   - "他/她/我/你" 类的参与者代词变化 → 场景判定
 *   - 场景关键词（走进/离开/来到/回到/在...里）→ 场景切换信号
 *
 * 规则：若连续 2+ segments 的参与者不变且无场景切换信号，视为同一 scene
 */
function mergeSceneCoherence(units: IntentUnit[]): IntentUnit[] {
  const result: IntentUnit[] = []
  let i = 0

  while (i < units.length) {
    const currentText = getRawText(units[i])
    const currentParticipants = extractParticipants(currentText)

    // 找连续同场景 segment
    const startingType = units[i].type
    const sceneGroup: IntentUnit[] = [units[i]]
    let j = i + 1
    while (j < units.length) {
      const nextText = getRawText(units[j])
      const nextParticipants = extractParticipants(nextText)

      // 场景切换信号：出现场景描述关键词
      if (hasSceneChangeSignal(nextText)) break

      // 参与者变化：如果 participants 完全不同，视为切换
      if (!isSameScene(currentParticipants, nextParticipants)) break

      // dialogue 和非 dialogue 不能跨类型合并到同一 scene group
      if (units[j].type !== startingType) break

      // 节奏转折：scene 内检测到节奏转折点就分割
      if (sceneGroup.length >= 3 && hasSceneBeatSignal(nextText)) {
        break
      }

      sceneGroup.push(units[j])
      j++
    }

    if (sceneGroup.length >= 2) {
      result.push(mergeUnitGroup(sceneGroup, 'mixed'))
    } else {
      result.push(units[i])
    }

    i = j
  }

  return result
}

// ─── Round 3: Motion Chain Merge ───

/**
 * 合并连续 action/motion segments 为 1 个 shot cluster
 * 规则：连续 build_up/action/mixed 类型的 segment 合并
 * 并且 intensity 在 ±0.3 范围内
 */
function mergeMotionChain(units: IntentUnit[]): IntentUnit[] {
  const result: IntentUnit[] = []
  let i = 0

  while (i < units.length) {
    if (isActionType(units[i])) {
      const motionGroup: IntentUnit[] = [units[i]]
      let j = i + 1
      while (j < units.length && isActionType(units[j])) {
        const intDiff = Math.abs(units[j].intensity - motionGroup[0].intensity)
        if (intDiff > 0.3) break // intensity 突变时断开
        motionGroup.push(units[j])
        j++
      }

      if (motionGroup.length >= 2) {
        result.push(mergeUnitGroup(motionGroup, 'action'))
      } else {
        result.push(units[i])
      }

      i = j
    } else {
      result.push(units[i])
      i++
    }
  }

  return result
}

// ─── Round 4: Emotion Continuity Merge ───

/**
 * emotion gradient smooth merge
 * 规则：若相邻两个 unit 的类型接近（reaction/peak/build_up/dialogue/mixed），
 * 且 intensity 差 < 0.2，合并为 1 个 unit
 *
 * 注意：这是 cross-cutting signal，不改变结构边界
 */
function mergeEmotionContinuity(units: IntentUnit[]): IntentUnit[] {
  const result: IntentUnit[] = []
  let i = 0

  while (i < units.length) {
    if (i + 1 < units.length) {
      const a = units[i]
      const b = units[i + 1]

      // 相邻 unit 都是"叙事连续性"类型（无结构边界）
      const mergeableTypes = ['reaction', 'peak', 'build_up', 'dialogue', 'mixed']
      const bothMergeable =
        mergeableTypes.includes(a.shotType) &&
        mergeableTypes.includes(b.shotType)

      if (bothMergeable && Math.abs(a.intensity - b.intensity) < 0.25) {
        result.push(mergeUnitGroup([a, b], a.type))
        i += 2
        continue
      }
    }

    result.push(units[i])
    i++
  }

  return result
}

// ─── 工具函数 ───

function inferIntentType(seg: NarrativeSequencedShot): IntentUnitType {
  if (seg.speechActMark) return 'dialogue'
  if (seg.grammarType === 'reaction') return 'reaction'
  if (seg.grammarType === 'transition') return 'transition'
  if (seg.grammarType === 'peak') return 'action'
  return 'action'
}

function mergeUnitGroup(group: IntentUnit[], targetType: IntentUnitType): IntentUnit {
  const allSegments = group.flatMap(u => u.segments)
  const avgIntensity =
    group.reduce((sum, u) => sum + u.intensity, 0) / group.length
  const hasSpeechAct = group.some(u => u.hasSpeechAct)
  const dominantSpeaker = group.find(u => u.dominantSpeaker !== null)?.dominantSpeaker ?? null

  // ShotGrammarType：取优先级最高的
  const priority: Record<ShotGrammarType, number> = {
    establishing: 0,
    insert: 1,
    build_up: 2,
    transition: 3,
    pov: 4,
    reaction: 5,
    peak: 6,
    release: 7,
  }
  const dominantShot = group
    .map(u => u.shotType)
    .sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0))[0]

  // framing hint：取最常见的
  const framingCounts: Record<string, number> = {}
  for (const u of group) {
    framingCounts[u.framingHint] = (framingCounts[u.framingHint] || 0) + 1
  }
  const dominantFraming = Object.entries(framingCounts)
    .sort((a, b) => b[1] - a[1])[0][0] as 'wide' | 'medium' | 'close'

  return {
    type: targetType,
    segments: allSegments,
    shotType: dominantShot,
    durationHint: group.length * 3.0, // 基础 3s × segment 数
    intensity: +avgIntensity.toFixed(3),
    hasSpeechAct,
    dominantSpeaker,
    framingHint: dominantFraming,
    cameraHint: 'static',
  }
}

function getRawText(unit: IntentUnit): string {
  return unit.segments.map(s => s.rawDescription).join(' ')
}

function extractParticipants(text: string): string[] {
  const participants: string[] = []
  const chars = text.match(/[他她它你我]/g)
  if (chars) participants.push(...chars)
  return [...new Set(participants)]
}

function hasSceneChangeSignal(text: string): boolean {
  const signals = [
    '走进', '离开', '来到', '回到',
    '外景', '内景', '场景', '夜景',
    '转移到', '切换', '下一个',
    '清晨', '午后', '傍晚', '深夜',
  ]
  return signals.some(s => text.includes(s))
}

function isSameScene(prev: string[], current: string[]): boolean {
  // 如果前后都没有参与者，可能是连续场景描述
  if (prev.length === 0 && current.length === 0) return true
  // 如果一方有参与者一方无 → 可能进入/离开 → 视为切换
  if (prev.length === 0 || current.length === 0) return false
  // 对话场景中参与者轮换（她→他→我你他）仍然属于同一场景
  // 只要两者都是人称代词（非 empty），视为同一场景
  const allChars = '他她它你我'
  const isAllPronouns = (ps: string[]) => ps.every(p => allChars.includes(p))
  if (isAllPronouns(prev) && isAllPronouns(current)) return true
  // 非人称 participant（地点/物体）变化 → 场景切换
  const overlap = prev.filter(p => current.includes(p))
  return overlap.length > 0
}

/**
 * 场景内节奏转折检测
 * 在 scene coherence merge 中，对于过长的 scene，检测是否有节奏转折点
 * 转折信号：场景描述（雨声/沉默）、动作转折（站起/离开/推门）
 */
function hasSceneBeatSignal(text: string): boolean {
  const beatSignals = [
    '突然', '沉默', '安静', '雨', '风', '声',
    '站起', '起身', '离开', '推门', '开门',
    '走进', '来到', '走向', '转过身',
    '夜晚', '暗处', '光线', '阴影',
  ]
  return beatSignals.some(s => text.includes(s))
}

function isActionType(unit: IntentUnit): boolean {
  return ['build_up', 'establishing'].includes(unit.shotType) || unit.type === 'action' || unit.type === 'mixed'
}

function getIntensity(seg: NarrativeSequencedShot): number {
  // 从 grammarType 映射默认 intensity
  const intensityMap: Partial<Record<ShotGrammarType, number>> = {
    establishing: 0.3,
    build_up: 0.5,
    insert: 0.4,
    transition: 0.2,
    reaction: 0.5,
    peak: 0.9,
    release: 0.3,
    pov: 0.6,
  }
  return intensityMap[seg.grammarType] ?? 0.5
}

function inferFraming(seg: NarrativeSequencedShot): 'wide' | 'medium' | 'close' {
  const map: Partial<Record<ShotGrammarType, 'wide' | 'medium' | 'close'>> = {
    establishing: 'wide',
    insert: 'close',
    peak: 'close',
    reaction: 'medium',
    build_up: 'medium',
    release: 'wide',
    transition: 'medium',
    pov: 'close',
  }
  return map[seg.grammarType] ?? 'medium'
}

function finalizeUnits(units: IntentUnit[]): IntentUnit[] {
  return units.map(unit => {
    // 后处理：duration 缩短（merge 后更紧凑）
    const mergedDuration = Math.max(2.5, Math.min(6.0, unit.segments.length * 2.0))
    return {
      ...unit,
      durationHint: +mergedDuration.toFixed(1),
      // framing 根据最终 shotType 重新校准
      framingHint: unit.type === 'dialogue' ? 'medium'
        : unit.type === 'transition' ? 'wide'
        : unit.framingHint,
      cameraHint: unit.shotType === 'peak' ? 'handheld'
        : unit.shotType === 'release' ? 'static'
        : 'static',
    }
  })
}
