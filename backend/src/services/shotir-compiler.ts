/**
 * SHOT IR COMPILER — Phase E1.5 (Deterministic Stabilization)
 *
 * ═══════════════════════════════════════════════════════════════
 * PHASE E1.5 CONSTITUTION
 *
 * Rules:
 * - ShotIR must be structurally decidable without probabilistic inference.
 * - LLM is FORBIDDEN from deciding: shot count, shot order, shot type, shot segmentation.
 * - LLM is ALLOWED only for leaf-node description polish (optional).
 * - compileVideo() receives PromptIR with shots already fully populated.
 * - NO runtime injection. NO fallback generation.
 *
 * Architecture:
 *   narrative
 *     → determineShotStructure()     100% deterministic, rule-based
 *     → L1/L1E enrichment            rule-based fact grid
 *     → [optional] LLM polish        leaf node only (visualDescription wording)
 *     → checkPreservationGuard()     deterministic validation
 *     → ShotIR[]
 *
 * This is NOT an "AI generator".
 * This is a compiler with optional LLM-only leaf nodes.
 * ═══════════════════════════════════════════════════════════════
 */

import type { PromptIR } from '../types/promptIR.js'

// ─── Types ──────────────────────────────────────────────────────────

export type ShotType = 'establishing' | 'dialogue' | 'action' | 'reaction' | 'detail' | 'transition'
export type Framing = 'wide' | 'full' | 'medium' | 'medium-close' | 'close-up' | 'extreme-close-up' | 'over-shoulder'
export type CameraMovement = 'static' | 'push-in' | 'pull-out' | 'track' | 'pan' | 'tilt' | 'crane' | 'handheld' | 'dolly-zoom'
export type InferenceLevel = 0 | 1

export interface FactGridV2 {
  explicit: {
    entities: string[]
    locations: string[]
    props: string[]
    events: string[]
    descriptors: string[]
  }
  impliedActions: string[]
  environmentCompletion: string[]
}

export interface PreservationGuardViolation {
  type: 'UNKNOWN_ENTITY' | 'UNKNOWN_LOCATION' | 'UNKNOWN_RELATION' | 'NARRATIVE_MUTATION' | 'INFERENCE_LEVEL_EXCEEDED' | 'OVERLOAD' | 'STRUCTURE_ERROR'
  detail: string
  shotIndex: number
}

export interface ShotIR {
  shotType: ShotType
  subject: string
  visualDescription: string
  camera: {
    framing: Framing
    movement?: CameraMovement
    angle?: string
  }
  lighting?: string
  mood?: string
  duration?: number
  preservation: {
    inferenceLevel: InferenceLevel
    sourceFacts: string[]
  }
}

export interface ShotIRCompileResult {
  ok: boolean
  shots: ShotIR[]
  violations: PreservationGuardViolation[]
  factGrid: FactGridV2
}

/** Shot skeleton (pre-description-enrichment) */
interface ShotSkeleton {
  shotType: ShotType
  subject: string
  camera: { framing: Framing; movement?: CameraMovement; angle?: string }
  lighting: string
  mood: string
  duration: number
}

// ─── Constants ─────────────────────────────────────────────────────

const ENVIRONMENT_BUDGET = {
  maxItems: 5,
  perCategoryLimit: 2,
  priorityOrder: ['physical_surface', 'light_behavior', 'weather_effect', 'ambient_sound'] as const,
}

const ALLOWED_LENS_TERMS = new Set([
  'wide', 'full', 'medium', 'medium-close', 'close-up', 'extreme-close-up', 'over-shoulder',
  'static', 'push-in', 'pull-out', 'track', 'pan', 'tilt', 'crane', 'handheld', 'dolly-zoom',
  'eye-level', 'low-angle', 'high-angle', "bird's-eye", 'dutch-angle',
  'establishing', 'dialogue', 'action', 'reaction', 'detail', 'transition',
])

const CAMERA_BY_SHOT_TYPE: Record<ShotType, { framing: Framing; movement: CameraMovement; angle: string }> = {
  establishing:   { framing: 'wide',   movement: 'push-in',  angle: 'eye-level' },
  dialogue:       { framing: 'medium', movement: 'static',    angle: 'eye-level' },
  action:         { framing: 'full',   movement: 'track',    angle: 'eye-level' },
  reaction:       { framing: 'close-up', movement: 'static', angle: 'eye-level' },
  detail:         { framing: 'extreme-close-up', movement: 'static', angle: 'eye-level' },
  transition:     { framing: 'wide',   movement: 'pan',      angle: 'eye-level' },
}

// ─── 1. FactGrid v2 Extractor (deterministic, no LLM) ──────────────

export function extractFactGridV2(narrative: string): FactGridV2 {
  const explicit: FactGridV2['explicit'] = {
    entities: [], locations: [], props: [], events: [], descriptors: [],
  }
  const impliedActions: string[] = []
  const environmentCompletion: string[] = []

  if (!narrative || !narrative.trim()) return { explicit, impliedActions, environmentCompletion }

  const text = narrative.trim()

  // ── L0: Entities (rule-based, regex) ──
  const entityMatches = text.match(/[（(]?[的]?([\u4e00-\u9fff]{2,4})[)）]?[在着和与]/g)
  if (entityMatches) {
    for (const m of entityMatches) {
      const candidate = m.replace(/[在着和与（()）]/g, '').trim()
      if (candidate && !/^[他她它你我]$/.test(candidate) && !explicit.entities.includes(candidate)) {
        explicit.entities.push(candidate)
      }
    }
  }

  const verbEntityPattern = /([\u4e00-\u9fff]{2,4})([走跑跳站坐撑敲端打关开进按])/g
  let match
  while ((match = verbEntityPattern.exec(text)) !== null) {
    const entity = match[1]
    if (!/^[他她它你我]$/.test(entity) && !explicit.entities.includes(entity)) {
      explicit.entities.push(entity)
    }
  }

  // ── L0: Locations ──
  const locationMatches = text.match(/在([\u4e00-\u9fff]{2,6})([里中上下内前])/g)
  if (locationMatches) {
    for (const m of locationMatches) {
      const loc = m.replace(/在|里|中|上|下|内|前/g, '').trim()
      if (loc && !explicit.locations.includes(loc)) explicit.locations.push(loc)
    }
  }

  const knownLocations = ['雨夜', '路口', '公园', '教室', '海边', '办公室', '咖啡店', '厨房', '走廊', '屋顶', '医院', '手术室', '电梯', '街道', '雨中']
  for (const loc of knownLocations) {
    if (text.includes(loc) && !explicit.locations.includes(loc)) explicit.locations.push(loc)
  }

  // ── L0: Events ──
  const eventCandidates: { verb: string; label: string }[] = [
    { verb: '等', label: '等人' }, { verb: '撑', label: '撑伞' },
    { verb: '骑', label: '骑自行车' }, { verb: '敲', label: '敲代码' },
    { verb: '跑', label: '跑进' }, { verb: '站', label: '站着' },
    { verb: '坐', label: '坐着' }, { verb: '对话', label: '对话' },
    { verb: '关门', label: '关门' }, { verb: '开门', label: '开门' },
    { verb: '亮着', label: '灯亮着' }, { verb: '收', label: '收到' },
    { verb: '哭', label: '哭了' }, { verb: '走进', label: '走进' },
    { verb: '打着伞', label: '撑伞' },
  ]
  for (const { verb, label } of eventCandidates) {
    if (text.includes(verb) && !explicit.events.includes(label)) explicit.events.push(label)
  }

  // ── L0: Descriptors ──
  const adjPattern = /([\u4e00-\u9fff]+)(的)([\u4e00-\u9fff]+)/g
  while ((match = adjPattern.exec(text)) !== null) {
    const desc = `${match[1].trim()}的${match[3].trim()}`
    if (!explicit.descriptors.includes(desc)) explicit.descriptors.push(desc)
  }

  // ── L1: Implied Actions ──
  const actionMap: Record<string, string[]> = {
    '等人': ['站立', '凝视远方'],
    '撑伞': ['被雨淋（从伞外溅到）'],
    '骑自行车': ['踩踏板'],
    '敲代码': ['看屏幕', '打字'],
    '跑进': ['推门'],
    '站着': ['站立'],
    '对话': ['面对', '看向彼此'],
    '关门': ['转身'],
    '关门走了': ['转身', '脚步离开'],
    '收到': ['打开', '看内容'],
    '哭了': ['流泪', '低头'],
    '走进': ['推门', '环顾'],
    '等着': ['站立', '看向前方'],
    '等待': ['站立', '看向前方'],
    '端汤走过来': ['看路', '慢慢走'],
    '打开冰箱': ['看里面', '伸手'],
    '打车': ['招手', '等车'],
    '下雨': ['躲雨', '衣服湿了'],
    '骑行': ['踩踏板'],
  }

  for (const evt of explicit.events) {
    const actions = actionMap[evt]
    if (actions) for (const a of actions) { if (!impliedActions.includes(a)) impliedActions.push(a) }
  }
  if (explicit.events.length === 0) {
    for (const [eventKey, actions] of Object.entries(actionMap)) {
      if (text.includes(eventKey)) {
        explicit.events.push(eventKey)
        for (const a of actions) { if (!impliedActions.includes(a)) impliedActions.push(a) }
      }
    }
  }

  // ── L1E: Environment Completion ──
  const envMap: Record<string, string[]> = {
    '雨夜': ['雨滴', '积水', '湿路面', '反光', '雨声'],
    '雨中': ['雨滴', '积水', '湿路面', '反光', '雨声'],
    '夜晚': ['路灯', '阴影', '寂静', '月光'],
    '夕阳': ['金色光线', '长影子', '暖色调'],
    '办公室': ['台灯光', '窗外黑暗', '键盘声', '显示器光'],
    '咖啡店': ['咖啡香气', '杯碟声', '暖光'],
    '公园': ['树影', '鸟鸣', '草地', '长椅'],
    '海边': ['海浪声', '海风', '沙滩', '地平线'],
    '教室': ['日光灯', '黑板', '桌椅', '书本'],
    '手术室': ['无影灯', '金属器械盘'],
    '路口': ['红绿灯', '车辆驶过', '路灯'],
    '街道': ['店铺招牌', '行人', '灯光'],
    '电梯': ['电梯灯', '按钮面板', '金属壁'],
    '房间': ['墙面', '窗户', '光线', '影子'],
    '厨房': ['台面', '水声', '灯光'],
  }

  // Check full text for location keywords
  const allLocKeys = Object.keys(envMap)
  for (const locKey of allLocKeys) {
    if (text.includes(locKey) && !explicit.locations.includes(locKey)) {
      explicit.locations.push(locKey)
    }
  }
  for (const loc of explicit.locations) {
    const envItems = envMap[loc]
    if (envItems) for (const item of envItems) { if (!environmentCompletion.includes(item)) environmentCompletion.push(item) }
  }

  // Fallback entity extraction
  if (explicit.entities.length === 0 && explicit.locations.length === 0 && explicit.events.length === 0) {
    const words = text.split(/[，。！？、\s]+/).filter(w => w.length >= 2)
    for (const w of words) {
      if (w.length >= 3 && /[\u4e00-\u9fff]/.test(w)) explicit.entities.push(w)
    }
  }

  // Apply Budget
  if (environmentCompletion.length > ENVIRONMENT_BUDGET.maxItems) {
    environmentCompletion.splice(ENVIRONMENT_BUDGET.maxItems)
  }

  return { explicit, impliedActions, environmentCompletion }
}

// ─── 2. Phase E1.6 — Shot Boundary Contract System ────────────────

/**
 * Phase E1.6: Boundary Contract Engine
 *
 * From count-first → contract-first.
 * Does NOT compute shot count, does NOT score, does NOT approximate semantics.
 * ONLY answers: "where must a boundary exist?"
 *
 * Contract rules:
 *   SPLIT triggers:
 *     timeShift      — narrative indicates passage of time (天亮/天黑/after/before)
 *     locationShift  — narrative indicates change of location (走向/转场/从…到…)
 *     subjectChange  — narrative shifts focus to different character
 *   MERGE rules:
 *     continuousMotion — same action chain, no interruption
 *   NO-OP (forbidden):
 *     totalFacts → shotCount
 *     keyword density heuristics
 *     emotional scoring segmentation
 *
 * Output: segments[] where 1 segment = 1 shot (strict 1:1 mapping).
 */

export type BoundaryType = 'temporal' | 'spatial' | 'subject'

export interface SplitReason {
  primary: BoundaryType
  /** Optional secondary dimensions (multi-causal boundaries) */
  secondary: BoundaryType[]
  /**
   * Boundary clarity (0.0-1.0) — NOT a weight/score.
   * Reflects how unambiguous the boundary signal is.
   * 1.0 = explicit marker present (e.g. "第二天")
   * 0.5 = inferred from context (e.g. verb change)
   * 0.0 = no boundary detected
   */
  strength: number
}

/** A detected narrative segment that maps 1:1 to a shot. */
export interface NarrativeSegment {
  /** Original text of this segment */
  text: string
  /** Events from FactGrid that fall within this segment */
  events: string[]
  /** Entities active in this segment */
  entities: string[]
  /** Location context */
  location: string
  /** Phase E1.7: Structured boundary type (multi-causal) */
  splitReason: SplitReason
  /** Whether this segment starts with a boundary transition */
  hasTransitionMarker: boolean
  /** Whether this segment is a continuous motion chain */
  isMotionChain: boolean
}

/** Shot skeleton (pre-description-enrichment) */
interface ShotSkeleton {
  shotType: ShotType
  subject: string
  camera: { framing: Framing; movement?: CameraMovement; angle?: string }
  lighting: string
  mood: string
  duration: number
}

// ─── Phase E1.7 — BCSG: Boundary-conditioned Shot Grammar ────────

/**
 * A BCSG Grammar Rule.
 *
 * Procedural, not declarative.
 * match: determines if this rule applies to a segment
 * apply: transforms the shot skeleton
 * priority: resolution order (higher = applied first)
 */
export type GrammarRule = {
  id: string
  match: (seg: NarrativeSegment) => boolean
  apply: (shot: ShotSkeleton, seg: NarrativeSegment) => ShotSkeleton
  priority: number
}

/** GrammarRule registry (mutable, for runtime registration). */
const grammarRules: GrammarRule[] = []

/**
 * Register a grammar rule.
 * Rules are inserted in priority order (highest first).
 */
export function registerGrammarRule(rule: GrammarRule): void {
  const idx = grammarRules.findIndex(r => r.priority < rule.priority)
  if (idx === -1) { grammarRules.push(rule) }
  else { grammarRules.splice(idx, 0, rule) }
}

/** Clear all grammar rules. */
export function clearGrammarRules(): void { grammarRules.length = 0 }

/** Get all registered grammar rules. */
export function getGrammarRules(): readonly GrammarRule[] { return grammarRules }

/**
 * Register default BCSG grammar rules.
 * Called once at system init via ensureBCSGRules().
 */
export function registerDefaultBCSGRules(): void {
  // R1: Temporal boundary → establishing-wide
  registerGrammarRule({
    id: 'bcsg-temporal-establishing', priority: 100,
    match: (seg) => seg.splitReason.primary === 'temporal',
    apply: (shot, _seg) => ({
      ...shot,
      shotType: shot.shotType === 'establishing' ? shot.shotType : 'transition',
      camera: { ...shot.camera, framing: 'wide', movement: 'push-in' },
      duration: 4.5,
    }),
  })
  // R2: Spatial boundary → wide + track
  registerGrammarRule({
    id: 'bcsg-spatial-wide', priority: 90,
    match: (seg) => seg.splitReason.primary === 'spatial' || seg.splitReason.secondary.includes('spatial'),
    apply: (shot, _seg) => ({
      ...shot, camera: { ...shot.camera, framing: 'wide', movement: 'track' }, duration: Math.max(shot.duration, 4.0),
    }),
  })
  // R3: Subject change → medium close-up
  registerGrammarRule({
    id: 'bcsg-subject-medium', priority: 80,
    match: (seg) => seg.splitReason.primary === 'subject',
    apply: (shot, _seg) => ({ ...shot, camera: { ...shot.camera, framing: 'medium', movement: 'static' } }),
  })
  // R4: Motion chain + action → action + track
  registerGrammarRule({
    id: 'bcsg-motion-action', priority: 70,
    match: (seg) => seg.isMotionChain && seg.events.some(e =>
      e.includes('骑') || e.includes('跑') || e.includes('撑伞') || e.includes('敲') ||
      e.includes('关门') || e.includes('打车') || e.includes('端着')),
    apply: (shot, _seg) => ({ ...shot, shotType: 'action', camera: { ...shot.camera, framing: 'full', movement: 'track' } }),
  })
  // R5: Reaction cues → close-up
  registerGrammarRule({
    id: 'bcsg-reaction-closeup', priority: 60,
    match: (seg) => seg.splitReason.primary === 'subject' && seg.events.some(e => e.includes('哭') || e.includes('等') || e.includes('凝视')),
    apply: (shot, _seg) => ({ ...shot, shotType: 'reaction', camera: { ...shot.camera, framing: 'close-up', movement: 'static' }, duration: 3.5 }),
  })
  // R6: Dialogue → over-shoulder
  registerGrammarRule({
    id: 'bcsg-dialogue-medium', priority: 50,
    match: (seg) => seg.events.some(e => e.includes('对话') || e.includes('说') || e.includes('聊')),
    apply: (shot, _seg) => ({ ...shot, shotType: 'dialogue', camera: { ...shot.camera, framing: 'over-shoulder' } }),
  })
}

/**
 * Phase E1.6: detect narrative boundaries using contract rules only.
 *
 * Input: raw narrative text + FactGrid (for entity/event/location knowledge)
 * Output: NarrativeSegment[] (each segment → exactly 1 shot)
 *
 * No LLM. No scoring. No count-based logic.
 */
export function detectBoundaries(
  narrative: string,
  factGrid: FactGridV2,
): NarrativeSegment[] {
  if (!narrative || !narrative.trim()) {
    return []
  }

  // ── Step 0: Normalize text for clause detection ──
  const text = narrative.trim()

  // ── Step 1: Split narrative into atomic clauses ──
  // Clauses are sentence-level units; we split on punctuation boundaries
  const rawClauses = splitClauses(text)

  // ── Step 2: Group clauses into segments using boundary contracts ──
  const segments = groupClausesByContract(rawClauses, factGrid)

  // ── Step 3: Apply MERGE rules (motion continuity) ──
  const merged = mergeMotionChains(segments)

  return merged
}

// ─── Sub: Clause Splitting ────────────────────────────────────────

/** Split a sentence into atomic clauses (simple Chinese segmentation). */
function splitClauses(text: string): string[] {
  // Split on sentence-ending punctuation + common clause markers
  const sentencePunct = /[。！？;；\n]+/
  const sentences = text.split(sentencePunct).filter(s => s.trim().length > 0)

  // For each sentence, further split on comma/顿号 for clause detection
  const clauses: string[] = []
  for (const sentence of sentences) {
    const subClauses = sentence.split(/[，、]/).filter(s => s.trim().length > 0)
    for (const sc of subClauses) {
      const trimmed = sc.trim()
      if (trimmed.length > 0) clauses.push(trimmed)
    }
  }

  return clauses.length > 0 ? clauses : [text]
}

// ─── Sub: Boundary Contract Checks ────────────────────────────────

/** SPLIT triggers — time shift markers */
const TIME_SHIFT_MARKERS = [
  '天亮', '天黑', '清晨', '黄昏', '午夜', '入夜', '拂晓',
  '过了一会儿', '片刻后', '良久', '许久', '片刻', '不久',
  '这时', '那时', '突然', '忽然', '霎时', '瞬间', '刹那',
  '此时', '此前', '此前', '同时', '之后', '之后',
  '前一天', '第二天', '次日', '当晚', '当天',
  '在此之前', '从此以后', '从那时起',
  'after a while', 'then', 'suddenly', 'later',
]

/** SPLIT triggers — location shift markers */
const LOCATION_SHIFT_MARKERS = [
  '走进', '走出', '跑进', '跑出', '来到', '离开', '走向',
  '穿过', '越过', '经过', '转入', '拐进', '进入', '进去',
  '出来', '出去', '上楼', '下楼', '回到', '回到',
  '从', '到', '往', '向',
]

/** SPLIT triggers — subject change markers */
const SUBJECT_CHANGE_MARKERS = [
  '而他', '而她', '而他', '而她', '而他俩',
  '另一边', '另一面', '与此同时',
  '看远方', '凝视', '看窗外',
]

/** Continuous motion verbs — indicate action chains */
const CONTINUOUS_MOTION_VERBS = [
  '走', '跑', '骑', '撑', '端', '拿', '敲', '打', '坐', '站',
  '喝', '吃', '看', '听', '说', '写', '画',
]

/**
 * Apply boundary contract to a single clause.
 * Returns the SPLIT/MERGE decision and the clause metadata.
 */
function classifyClause(
  clause: string,
  factGrid: FactGridV2,
): {
  hasTimeShift: boolean
  hasLocationShift: boolean
  hasSubjectChange: boolean
  isMotionVerb: boolean
  associatedLocation: string
  associatedEntity: string
} {
  let hasTimeShift = false
  let hasLocationShift = false
  let hasSubjectChange = false
  let isMotionVerb = false
  let associatedLocation = ''
  let associatedEntity = ''

  // ── Check time shift markers ──
  for (const marker of TIME_SHIFT_MARKERS) {
    if (clause.includes(marker)) {
      hasTimeShift = true
      break
    }
  }

  // ── Check location shift markers ──
  for (const marker of LOCATION_SHIFT_MARKERS) {
    if (clause.includes(marker)) {
      hasLocationShift = true
      break
    }
  }

  // ── Check subject change markers ──
  for (const marker of SUBJECT_CHANGE_MARKERS) {
    if (clause.includes(marker)) {
      hasSubjectChange = true
      break
    }
  }

  // ── Check continuous motion verbs ──
  for (const verb of CONTINUOUS_MOTION_VERBS) {
    if (clause.includes(verb)) {
      isMotionVerb = true
      break
    }
  }

  // ── Associate with known locations ──
  for (const loc of factGrid.explicit.locations) {
    if (clause.includes(loc)) {
      associatedLocation = loc
      break
    }
  }

  // ── Associate with known entities ──
  for (const ent of factGrid.explicit.entities) {
    if (clause.includes(ent)) {
      associatedEntity = ent
      break
    }
  }

  return { hasTimeShift, hasLocationShift, hasSubjectChange, isMotionVerb, associatedLocation, associatedEntity }
}

// ─── Sub: Group Clauses by Boundary Contracts ────────────────────

function groupClausesByContract(
  clauses: string[],
  factGrid: FactGridV2,
): NarrativeSegment[] {
  if (clauses.length === 0) return []

  const segments: NarrativeSegment[] = []
  let currentSegment: string[] = []
  let lastLocation = ''
  let isMotionChain = false

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i]
    const classified = classifyClause(clause, factGrid)

    // Determine if this clause triggers a SPLIT
    const triggersSplit =
      classified.hasTimeShift ||
      classified.hasLocationShift ||
      classified.hasSubjectChange

    // Determine if this is a motion continuity clause
    const isMotion = classified.isMotionVerb

    // ── Decision: SPLIT or CONTINUE ──
    if (triggersSplit && currentSegment.length > 0) {
      // Flush current segment, start new one
      segments.push(buildSegment(currentSegment, factGrid, lastLocation, isMotionChain))
      currentSegment = [clause]
      lastLocation = classified.associatedLocation || lastLocation
      isMotionChain = isMotion
    } else {
      // Continue current segment
      currentSegment.push(clause)
      if (classified.associatedLocation) {
        lastLocation = classified.associatedLocation
      }
      // Motion chain: only if all clauses in segment are motion verbs
      isMotionChain = isMotionChain && isMotion
    }
  }

  // Flush last segment
  if (currentSegment.length > 0) {
    segments.push(buildSegment(currentSegment, factGrid, lastLocation, isMotionChain))
  }

  return segments
}

// ─── Sub: Build Single Segment ────────────────────────────────────

function buildSegment(
  clauses: string[],
  factGrid: FactGridV2,
  location: string,
  isMotionChain: boolean,
): NarrativeSegment {
  const text = clauses.join('，')

  // Find which events from FactGrid are present in this segment's text
  const events = factGrid.explicit.events.filter(e => text.includes(e) || text.includes(e.replace('了', '')))

  // Find active entities
  const entities = factGrid.explicit.entities.filter(e => text.includes(e))

  // ── Phase E1.7: Determine splitReason from contract triggers ──
  let primary: BoundaryType = 'temporal' // default only if hasTransitionMarker
  const secondary: BoundaryType[] = []
  let strength = 0.0

  // Check each clause for boundary signals
  let hasTime = false
  let hasSpace = false
  let hasSubj = false

  for (const clause of clauses) {
    if (TIME_SHIFT_MARKERS.some(m => clause.includes(m))) hasTime = true
    if (LOCATION_SHIFT_MARKERS.some(m => clause.includes(m))) hasSpace = true
    if (SUBJECT_CHANGE_MARKERS.some(m => clause.includes(m))) hasSubj = true
  }

  // Determine primary (most significant)
  if (hasTime) { primary = 'temporal'; strength = 1.0 }
  else if (hasSpace) { primary = 'spatial'; strength = 0.8 }
  else if (hasSubj) { primary = 'subject'; strength = 0.6 }

  if (hasTime && hasSpace) { strength = 1.0; if (!secondary.includes('spatial')) secondary.push('spatial') }
  if (hasTime && hasSubj) { if (!secondary.includes('subject')) secondary.push('subject') }
  if (hasSpace && hasSubj) { if (!secondary.includes('subject')) secondary.push('subject') }

  // If no explicit marker but it's a motion chain break, mark as spatial
  if (!hasTime && !hasSpace && !hasSubj && !isMotionChain && clauses.length > 1) {
    // Implied action continuity break
    primary = 'subject'
    strength = 0.4
  }

  const splitReason: SplitReason = { primary, secondary, strength }

  // Has transition marker if the first clause starts with a known shift
  const firstClause = clauses[0] || ''
  const hasTransitionMarker = firstClause.length <= 8 && (
    TIME_SHIFT_MARKERS.some(m => firstClause.startsWith(m) || firstClause.includes(m)) ||
    SUBJECT_CHANGE_MARKERS.some(m => firstClause.startsWith(m) || firstClause.includes(m))
  )

  return {
    text,
    events,
    entities,
    location: location || factGrid.explicit.locations[0] || '',
    splitReason,
    hasTransitionMarker,
    isMotionChain,
  }
}

// ─── Sub: MERGE Rules — Motion Continuity ─────────────────────────

function mergeMotionChains(segments: NarrativeSegment[]): NarrativeSegment[] {
  if (segments.length <= 1) return segments

  const merged: NarrativeSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]
    const next = segments[i + 1]

    if (next && shouldMerge(current, next)) {
      // Merge next into current, skip next
      // Phase E1.7: merge splitReason — keep primary from first, extend secondary
      const mergedSecondary = [
        ...new Set([...current.splitReason.secondary, ...next.splitReason.secondary]),
      ].slice(0, 3)
      const mergedSegment: NarrativeSegment = {
        text: current.text + '，' + next.text,
        events: [...new Set([...current.events, ...next.events])],
        entities: [...new Set([...current.entities, ...next.entities])],
        location: next.location || current.location,
        splitReason: {
          primary: current.splitReason.primary,
          secondary: mergedSecondary,
          strength: Math.max(current.splitReason.strength, next.splitReason.strength),
        },
        hasTransitionMarker: current.hasTransitionMarker,
        isMotionChain: current.isMotionChain && next.isMotionChain,
      }
      merged.push(mergedSegment)
      i++ // skip next
    } else {
      merged.push(current)
    }
  }

  return merged
}

function shouldMerge(a: NarrativeSegment, b: NarrativeSegment): boolean {
  // MERGE only if BOTH are motion chains (continuous motion)
  if (!a.isMotionChain || !b.isMotionChain) return false

  // Same subject?
  const aEntity = a.entities[0]
  const bEntity = b.entities[0]
  if (aEntity && bEntity && aEntity !== bEntity) return false

  return true
}

// ─── 3. Build ShotIR from Segments (1:1 mapping) ─────────────────

/**
 * Phase E1.7: Dual-phase pipeline.
 *
 * phase 1 — base: simple deterministic mapping (segment → minimal skeleton)
 * phase 2 — enhanced: BCSG GrammarRule registry applies transformations
 *
 * Each segment → exactly 1 shot (invariant).
 * BCSG rules may change shot type, framing, duration — but NOT origin segment.
 */
export function segmentsToSkeletons(
  segments: NarrativeSegment[],
  factGrid: FactGridV2,
  applyBCSG: boolean = true,
): ShotSkeleton[] {
  if (segments.length === 0) return []

  // ── Phase 1: Base mapping (minimal deterministic) ──
  const skeletons: ShotSkeleton[] = []
  const primarySubject = factGrid.explicit.entities[0] || factGrid.explicit.locations[0] || ''

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // Minimal shot type: first=establishing, last=transition, else=detail
    const shotType: ShotType =
      i === 0 ? 'establishing' :
      i === segments.length - 1 && segments.length > 1 ? 'transition' :
      'detail'

    const cameraDefault = CAMERA_BY_SHOT_TYPE[shotType]
    const subject = shotType === 'establishing'
      ? (seg.location || primarySubject)
      : (seg.entities[0] || primarySubject)

    skeletons.push({
      shotType,
      subject,
      camera: {
        framing: cameraDefault.framing,
        movement: cameraDefault.movement,
        angle: cameraDefault.angle,
      },
      lighting: 'natural',
      mood: 'neutral',
      duration: shotType === 'establishing' || shotType === 'transition' ? 4.0 : 3.0,
    })
  }

  // ── Phase 2: BCSG GrammarRule enhancement ──
  if (applyBCSG && grammarRules.length > 0) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      let shot = skeletons[i]

      // Apply matching rules in priority order
      for (const rule of grammarRules) {
        if (rule.match(seg)) {
          shot = rule.apply(shot, seg)
        }
      }

      skeletons[i] = shot
    }
  }

  return skeletons
}

// ─── 4. Phase E1.6/7 — Combined entries ──────────────────────────

/**
 * Phase E1.7: Calculate shot metrics for downstream consumption.
 * Pure function, no side effects.
 */
export function shotMetricsFromSegments(segments: NarrativeSegment[]): {
  shotCount: number
  boundaryTypes: BoundaryType[]
  hasMotionChain: boolean
} {
  const types = new Set<BoundaryType>()
  for (const seg of segments) {
    types.add(seg.splitReason.primary)
  }
  return {
    shotCount: segments.length,
    boundaryTypes: [...types],
    hasMotionChain: segments.some(s => s.isMotionChain),
  }
}

/**
 * Phase E1.6: Updated determineShotStructure — now calls boundary contracts.
 *
 * Wraps the three-step pipeline:
 *   detectBoundaries(text, factGrid) → segments
 *   → segmentsToSkeletons(segments, factGrid) → skeletons
 */
export function determineShotStructure(factGrid: FactGridV2): ShotSkeleton[] {
  // Without narrative text, we need a minimal fallback
  // (This shouldn't happen in normal flow — narrative always exists at this point)
  const mockNarrative = [
    ...factGrid.explicit.events,
    ...factGrid.explicit.locations.map(l => `在${l}`),
    ...factGrid.explicit.entities.map(e => `${e}出现`),
  ].join('，')

  const segments = detectBoundaries(mockNarrative, factGrid)

  if (segments.length === 0) {
    // Epic fallback: at least 1 shot
    return [{
      shotType: 'establishing' as ShotType,
      subject: factGrid.explicit.entities[0] || factGrid.explicit.locations[0] || '',
      camera: { framing: 'wide' as Framing, movement: 'static' as CameraMovement, angle: 'eye-level' },
      lighting: 'natural',
      mood: 'neutral',
      duration: 4.0,
    }]
  }

  return segmentsToSkeletons(segments, factGrid)
}

// ─── 3. Enrich Skeleton → ShotIR ──────────────────────────────────

/**
 * Apply L1/L1E enrichment to skeletons.
 * Sets mood, lighting, and initial visualDescription from FactGrid.
 * All rule-based — no LLM.
 */
export function enrichSkeletons(
  skeletons: ShotSkeleton[],
  factGrid: FactGridV2,
): ShotIR[] {
  const shots: ShotIR[] = []

  for (let i = 0; i < skeletons.length; i++) {
    const s = skeletons[i]
    const shotType = s.shotType

    // Build visualDescription from skeleton + FactGrid
    const envDesc = factGrid.environmentCompletion.length > 0
      ? factGrid.environmentCompletion.slice(0, 3).join('、')
      : ''
    const impliedDesc = factGrid.impliedActions.length > 0
      ? factGrid.impliedActions[0]
      : ''

    let visualDescription = s.subject
    if (shotType === 'establishing') {
      visualDescription = `${s.subject}的全景`
      if (envDesc) visualDescription += `，${envDesc}`
    } else if (shotType === 'detail') {
      visualDescription = `${s.subject}的细节特写`
    } else if (shotType === 'reaction') {
      visualDescription = impliedDesc
        ? `${s.subject}${impliedDesc}`
        : `${s.subject}的表情`
    } else if (shotType === 'action') {
      visualDescription = factGrid.explicit.events[0]
        ? `${s.subject}在${factGrid.explicit.events[0]}`
        : `${s.subject}的动作`
    } else {
      visualDescription = `${s.subject}`
      if (envDesc) visualDescription += `，${envDesc}`
    }

    // Build sourceFacts from FactGrid
    const sourceFacts: string[] = [
      ...factGrid.explicit.entities,
      ...factGrid.explicit.locations,
      ...factGrid.explicit.events,
    ]

    // Mood from shot type + implied actions
    let mood = s.mood
    if (shotType === 'establishing') mood = factGrid.environmentCompletion.includes('雨声') ? '忧郁' : '平静'
    else if (shotType === 'reaction') mood = factGrid.explicit.events.some(e => e.includes('哭')) ? '悲伤' : '思考'
    else if (shotType === 'action') mood = '动态'

    // Lighting from environment
    let lighting = s.lighting
    if (factGrid.explicit.locations.includes('夜晚') || factGrid.explicit.locations.includes('雨夜') || factGrid.explicit.locations.includes('雨中')) {
      lighting = '暗调'
    } else if (factGrid.explicit.locations.includes('夕阳')) {
      lighting = '暖色背光'
    } else if (factGrid.explicit.locations.includes('办公室')) {
      lighting = '台灯'
    } else if (factGrid.explicit.locations.includes('手术室')) {
      lighting = '无影灯'
    }

    shots.push({
      shotType,
      subject: s.subject,
      visualDescription,
      camera: { ...s.camera },
      lighting,
      mood,
      duration: s.duration,
      preservation: {
        inferenceLevel: envDesc ? 1 : 0 as InferenceLevel,
        sourceFacts,
      },
    })
  }

  return shots
}

// ─── 4. PreservationGuard ──────────────────────────────────────────

export function checkPreservationGuard(
  shot: ShotIR,
  factGrid: FactGridV2,
  shotIndex: number,
): PreservationGuardViolation[] {
  const violations: PreservationGuardViolation[] = []

  const knownEntities = new Set([
    ...factGrid.explicit.entities,
    ...factGrid.explicit.locations,
    ...factGrid.explicit.props,
    ...factGrid.impliedActions,
    ...factGrid.environmentCompletion,
  ])

  function isLensTerm(word: string): boolean {
    return ALLOWED_LENS_TERMS.has(word.toLowerCase()) || ALLOWED_LENS_TERMS.has(word)
  }

  if (shot.subject && !knownEntities.has(shot.subject) && !isLensTerm(shot.subject)) {
    violations.push({ type: 'UNKNOWN_ENTITY', detail: `Subject '${shot.subject}' not found in FactGrid`, shotIndex })
  }

  const words = shot.visualDescription.split(/[，。、\s]+/).filter(w => w.length >= 2)
  for (const word of words) {
    if (isLensTerm(word)) continue
    if (knownEntities.has(word)) continue
    const genericEnvWords = new Set(['天空', '地面', '墙壁', '窗户', '门', '光线', '影子', '空气', '灯光', '墙面', '路面', '地面', '倒影', '色彩', '色调'])
    if (genericEnvWords.has(word) && shot.preservation.inferenceLevel >= 1) continue
    violations.push({ type: 'UNKNOWN_ENTITY', detail: `Entity '${word}' in visualDescription not found in FactGrid`, shotIndex })
  }

  if (shot.preservation.inferenceLevel > 1) {
    violations.push({ type: 'INFERENCE_LEVEL_EXCEEDED', detail: `Inference level ${shot.preservation.inferenceLevel} exceeds max (1)`, shotIndex })
  }

  return violations
}

// ─── BCSG initialization guard ───────────────────────────────────

let _bcsgInitialized = false

/** Ensure default BCSG rules are registered (idempotent). */
function ensureBCSGRules(): void {
  if (!_bcsgInitialized) {
    registerDefaultBCSGRules()
    _bcsgInitialized = true
  }
}

// ─── 5. Main Entry — SYNC, deterministic ───────────────────────

/**
 * Phase E1.7: Build ShotIR from PromptIR.
 *
 * SYNC. Deterministic. No LLM in shot structure.
 * LLM polish is OPTIONAL and called separately.
 *
 * Flow:
 *   narrative
 *     → extractFactGridV2()
 *     → detectBoundaries() [E1.6 contract-first]
 *     → segmentsToSkeletons(segments, factGrid, applyBCSG=true) [E1.7 dual-phase]
 *     → enrichSkeletons() [L1/L1E]
 *     → checkPreservationGuard()
 */
export function buildShotIR(promptIR: PromptIR): ShotIRCompileResult {
  const narrative = promptIR.script?.narrative || ''

  if (!narrative.trim()) {
    return { ok: false, shots: [], violations: [], factGrid: extractFactGridV2('') }
  }

  // Step 0: Ensure BCSG rules are registered (one-time)
  ensureBCSGRules()

  // Step 1: FactGrid (deterministic)
  const factGrid = extractFactGridV2(narrative)

  // Step 2: Phase E1.6 Boundary Contract Engine
  //   detectBoundaries(narrative, factGrid) → segments[]
  const segments = detectBoundaries(narrative, factGrid)

  // Step 3: Phase E1.7 BCSG dual-phase shotgun
  //   Phase 1: base mapping (minimal — all detail except first/last)
  //   Phase 2: BCSG GrammarRule registry enhancement
  const skeletons = segmentsToSkeletons(segments, factGrid, true)

  if (skeletons.length === 0) {
    return { ok: false, shots: [], violations: [{ type: 'STRUCTURE_ERROR', detail: 'Failed to determine shot structure', shotIndex: -1 }], factGrid }
  }

  // Step 3: Enrich with L1/L1E (deterministic)
  const shots = enrichSkeletons(skeletons, factGrid)

  // Step 4: PreservationGuard
  const allViolations: PreservationGuardViolation[] = []
  for (let i = 0; i < shots.length; i++) {
    allViolations.push(...checkPreservationGuard(shots[i], factGrid, i))
  }

  return {
    ok: allViolations.length === 0,
    shots: allViolations.length === 0 ? shots : [],
    violations: allViolations,
    factGrid,
  }
}

// ─── 6. Optional LLM Polish (leaf node only) ──────────────────────

/**
 * Phase E1.5: OPTIONAL LLM polish for visualDescription wording only.
 *
 * This function is NEVER called from the main compile path.
 * It is a separate, optional enrichment step.
 *
 * LLM constraints:
 * - MUST preserve shot structure (shot count, types, ordering unchanged)
 * - MUST preserve subject and sourceFacts
 * - ONLY rewrites visualDescription phrasing
 * - ONLY adjusts mood/lighting wording, not presence
 */
import { narrativeGateway } from '../runtime/narrative-gateway.js'

export async function polishDescriptions(
  shots: ShotIR[],
  factGrid: FactGridV2,
  userId?: string,
): Promise<ShotIR[]> {
  // Build a minimal prompt that constrains LLM to leaf nodes only
  const systemPrompt = `You are a description polish engine. You do NOT change shot structure.

CONSTRAINTS (DO NOT VIOLATE):
- Do NOT change shot type, count, or ordering
- Do NOT add new entities, locations, or events
- Do NOT change the narrative facts
- You may ONLY rewrite "visualDescription" field wording
- You may suggest a better mood/lighting keyword
- Keep descriptions concise (1 sentence, <60 chars)

Output format: JSON array of {"index": number, "visualDescription": string, "mood": string, "lighting": string}
Return ONLY the changed fields.`

  const userMessage = JSON.stringify({
    factGrid: {
      entities: factGrid.explicit.entities,
      locations: factGrid.explicit.locations,
      events: factGrid.explicit.events,
    },
    shots: shots.map((s, i) => ({
      index: i,
      shotType: s.shotType,
      subject: s.subject,
      visualDescription: s.visualDescription,
      mood: s.mood,
      lighting: s.lighting,
    })),
  })

  try {
    const response = await narrativeGateway.execute({
      systemPrompt,
      userMessage,
      userId: userId || 'anonymous',
      timeoutTier: 'normal',
      maxTokens: 1024,
      temperature: 0.2,
    })

    let raw = response.content.trim()
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) raw = codeBlockMatch[1].trim()

    const polishResults: Array<{ index: number; visualDescription?: string; mood?: string; lighting?: string }> = JSON.parse(raw)

    if (Array.isArray(polishResults)) {
      for (const p of polishResults) {
        const targetIdx = p.index
        if (targetIdx >= 0 && targetIdx < shots.length) {
          // Only apply description changes, NEVER structural changes
          if (p.visualDescription && typeof p.visualDescription === 'string') {
            // Verify no new entities leaked in
            const words = p.visualDescription.split(/[，。、\s]+/).filter(w => w.length >= 2)
            const knownEntities = new Set([...factGrid.explicit.entities, ...factGrid.explicit.locations, ...factGrid.explicit.events])
            const unknownWords = words.filter(w => !knownEntities.has(w) && !ALLOWED_LENS_TERMS.has(w.toLowerCase()) && !ALLOWED_LENS_TERMS.has(w))
            // Generic env words allowed
            const genericEnv = new Set(['天空', '地面', '墙壁', '窗户', '门', '光线', '影子', '空气', '灯光', '路面', '倒影', '色彩'])
            const leakyWords = unknownWords.filter(w => !genericEnv.has(w))
            if (leakyWords.length === 0) {
              shots[targetIdx].visualDescription = p.visualDescription
            }
          }
          if (p.mood && typeof p.mood === 'string') {
            shots[targetIdx].mood = p.mood
          }
          if (p.lighting && typeof p.lighting === 'string') {
            shots[targetIdx].lighting = p.lighting
          }
        }
      }
    }
  } catch {
    // Polish failure is non-critical — return original shots
  }

  return shots
}

// ─── 7. Build & Inject ShotIR into PromptIR (primary entry) ─────

/**
 * Phase E1.5 primary entry:
 *   buildShotIR() (sync, deterministic)
 *   → optional polishDescriptions() (async, LLM leaf node)
 *   → inject into PromptIR
 *
 * Callers MUST use this function before calling compileVideo().
 * compileVideo() MUST receive PromptIR with shots already populated.
 */
export async function buildAndInjectShotIR(
  promptIR: PromptIR,
  options?: { enablePolish?: boolean; userId?: string },
): Promise<{ promptIR: PromptIR; shotResult: ShotIRCompileResult }> {
  const enablePolish = options?.enablePolish ?? false
  const userId = options?.userId

  // Step 1: Build ShotIR (sync, deterministic)
  const shotResult = buildShotIR(promptIR)

  if (!shotResult.ok || shotResult.shots.length === 0) {
    return { promptIR, shotResult }
  }

  // Step 2: Optional LLM polish (leaf node only)
  let shots = shotResult.shots
  if (enablePolish) {
    shots = await polishDescriptions(shots, shotResult.factGrid, userId)
  }

  // Step 3: Inject into PromptIR.breakdown.shots
  const mappedShots = shots.map((shot, i) => ({
    second: (shot.duration ?? 3) * i,
    camera: shot.camera.framing,
    movement: shot.camera.movement || 'static',
    action: shot.visualDescription,
    subject: shot.subject,
    environment: shot.lighting || shot.mood || '',
    effect: '',
    dialogue: '',
    expression: shot.mood || 'neutral',
    shotType: shot.shotType,
  }))

  const enriched = { ...promptIR }
  if (!enriched.breakdown) {
    (enriched as any).breakdown = { shots: [], characters: [], scenes: [] }
  }
  ;(enriched.breakdown as any).shots = mappedShots

  return { promptIR: enriched, shotResult: { ...shotResult, shots } }
}
