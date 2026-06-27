/**
 * Film Compiler v0 — V3 → Canonical FilmLanguageIR
 *
 * ═══════════════════════════════════════════════════════════════
 * 这是昆仑镜第一个真正的 Compiler。
 *
 *   V3 NarrativeConstitution（LLM 产出）
 *   │
 *   └── compileFromV3() ── 确定性、纯函数、Provider 无关
 *       │
 *       ▼
 *   Canonical FilmLanguageIR（冻结的内核契约）
 *
 * 性质：
 *   ① Deterministic：相同 V3 永远输出相同 FilmIR（无随机、无状态）
 *   ② Side-effect Free：不访问 DB、不查 Provider、不修改 Runtime
 *   ③ Provider Agnostic：不出现在意任何 Provider 名称
 *
 * A4: Compiler v0（只做 V3→FilmIR 映射）
 * A6: 完整的 FilmCompiler（Parser → Normalizer → Constraint Builder → Graph Builder）
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { NarrativeConstitutionV3, V3SegmentSpec, V3CharacterSpec, V3SceneSpec } from '../agents/narrative-schema-v3.js'
import type { FilmLanguageIR, FilmIRCharacter, FilmIRAction, FilmIRScene, FilmIRCamera } from './film-language-ir.js'
import { createFilmIRMetadata, freezeFilmIR } from './film-language-ir.js'

// ─── 景别映射（V3 → FilmIR 标准化） ──────────────────────

// ─── V3 → FilmIR 编译 ────────────────────────────────────

/**
 * 从 NarrativeConstitutionV3 编译 Canonical FilmLanguageIR。
 *
 * ⚡ 确定性：相同 V3 永远得到相同 FilmIR
 * 🧹 纯函数：不访问外部状态
 * 🔗 Provider 无关：不包含任何 Provider 特定逻辑
 *
 * @param v3 - NarrativeConstitutionV3（LLM 输出的世界模型）
 * @returns 冻结的 FilmLanguageIR
 */
export function compileFromV3(v3: NarrativeConstitutionV3): FilmLanguageIR {
  // 1. 从 segments 推导全局信息
  const totalDuration = v3.segments.reduce((sum, seg) => sum + (seg.duration || 5), 0)
  const firstSeg = v3.segments[0]
  const lastSeg = v3.segments[v3.segments.length - 1]

  // 2. 构建场景 map
  const sceneMap = new Map<string, V3SceneSpec>()
  for (const scene of v3.scenes) {
    sceneMap.set(scene.id, scene)
  }

  // 3. 构建角色 map
  const charMap = new Map<string, V3CharacterSpec>()
  for (const c of v3.characters) {
    charMap.set(c.id, c)
  }

  // 4. 编译 scene（优先 segment.environment，fallback 到 scene spec）
  const scenes = compileScenes(v3.segments, sceneMap, firstSeg, lastSeg)

  // 5. 编译 characters（按出场频率排序）
  const characters = compileCharacters(v3.segments, v3.characters)

  // 6. 编译 camera（以首个 segment 为主）
  const camera = compileCamera(firstSeg)

  // 7. 编译 action 列表（每个 segment 一个 action）
  const actions = compileActions(v3.segments)

  // 8. 编译 lighting
  const lighting = compileLighting(firstSeg)

  // 9. 编译 environment
  const environment = compileEnvironment(firstSeg)

  // 10. 编译约束
  const constraints = compileConstraints(v3)

  // 11. 编译 style
  const style = compileStyle(v3, firstSeg)

  // 12. 构建完整 FilmIR
  const filmIR: FilmLanguageIR = {
    metadata: createFilmIRMetadata({
      createdBy: 'film-compiler@0.1',
      source: 'film-compiler-v3',
      confidence: 1.0,
      schemaVersion: 'film-ir@0.1',
    }),
    global: {
      duration: totalDuration,
      mood: firstSeg?.emotion?.type || '',
      narrativePurpose: v3.storyArc?.setup?.slice(0, 100) || '',
      genre: '',
    },
    scene: scenes,
    characters,
    camera,
    lighting,
    action: actions,
    environment,
    style,
    constraints,
    references: {},
  }

  return freezeFilmIR(filmIR)
}

// ─── 内部编译函数（纯函数，无副作用） ─────────────────────

function compileScenes(
  segments: V3SegmentSpec[],
  sceneMap: Map<string, V3SceneSpec>,
  firstSeg?: V3SegmentSpec,
  lastSeg?: V3SegmentSpec,
): FilmIRScene {
  const firstScene = firstSeg ? sceneMap.get(firstSeg.sceneId) : undefined
  const env = firstSeg?.environment

  // 优先取 segment 级别的 environment.location（更具体）
  const location = env?.location || firstScene?.location || ''
  const environment = env?.location
    ? firstScene?.location
      ? env.location + '（' + firstScene.location + '）'
      : env.location
    : firstScene?.location || ''

  return {
    location,
    environment,
    timeOfDay: env?.timeOfDay || '',
    weather: env?.weather || '',
    year: '',
  }
}

function compileCharacters(
  segments: V3SegmentSpec[],
  charSpecs: V3CharacterSpec[],
): FilmIRCharacter[] {
  const charMap = new Map<string, V3CharacterSpec>()
  for (const c of charSpecs) charMap.set(c.id, c)

  // 从 segments 中收集所有出现的角色
  const presenceMap = new Map<string, { count: number; lastEmotion: string }>()
  for (const seg of segments) {
    for (const p of seg.characters || []) {
      const existing = presenceMap.get(p.characterId) || { count: 0, lastEmotion: '' }
      existing.count++
      existing.lastEmotion = p.emotion || existing.lastEmotion
      presenceMap.set(p.characterId, existing)
    }
  }

  // 按出场频率排序
  const sorted = [...presenceMap.entries()].sort((a, b) => b[1].count - a[1].count)

  return sorted.map(([charId, stats]) => {
    const spec = charMap.get(charId)
    const firstPresence = segments
      .flatMap(s => s.characters || [])
      .find(p => p.characterId === charId)

    return {
      name: spec?.name || charId,
      position: firstPresence?.focus
        ? '\u753B\u9762\u7126\u805A\u6743\u91CD ' + firstPresence.focus
        : '',
      motion: firstPresence?.action || '',
      expression: stats.lastEmotion,
      clothing: spec?.appearance?.slice(0, 50) || '',
      appearance: spec?.appearance || '',
    }
  })
}

function compileCamera(firstSeg?: V3SegmentSpec): FilmIRCamera {
  const cam = firstSeg?.camera
  return {
    shotType: normalizeShot(cam?.shot),
    movement: normalizeMovement(cam?.movement),
    angle: normalizeAngle(cam?.angle),
    focalLength: normalizeLens(cam?.lens),
    composition: '',
  }
}

/**
 * Camera 术语标准化（内联映射表）
 * 这些是从 V3 标准值到 FilmIR 中文值的映射。
 * 如果 V3 新增标准值，只需在这里追加。
 */

function normalizeShot(v: string | undefined): string {
  if (!v) return ''
  const map: Record<string, string> = {
    close_up: '特写',
    medium: '中景',
    wide: '全景',
    extreme_close_up: '大特写',
    medium_close_up: '中近景',
    medium_wide: '中全景',
    full: '全景',
  }
  return map[v] || v
}

function normalizeMovement(v: string | undefined): string {
  if (!v) return ''
  const map: Record<string, string> = {
    static: '固定',
    push_in: '推',
    pull_out: '拉',
    pan: '摇',
    tilt: '移',
    tracking: '跟',
    crane: '升降',
    handheld: '呼吸感',
    dolly: '推',
  }
  return map[v] || v
}

function normalizeAngle(v: string | undefined): string {
  if (!v) return ''
  const map: Record<string, string> = {
    eye_level: '平视',
    low_angle: '仰拍',
    high_angle: '俯拍',
    overhead: '俯拍',
    over_shoulder: '过肩',
    dutch: '倾斜',
  }
  return map[v] || v
}

function normalizeLens(v: string | undefined): string {
  if (!v) return ''
  const map: Record<string, string> = {
    '24mm': '广角',
    '35mm': '广角',
    '50mm': '标准',
    '85mm': '长焦',
    '135mm': '长焦',
  }
  return map[v] || v
}

function compileActions(segments: V3SegmentSpec[]): FilmIRAction[] {
  return segments.map((seg, i) => {
    const action = seg.action
    const charPresence = seg.characters?.[0]
    return {
      type: action?.primary || '',
      subject: charPresence?.characterId || '',
      target: action?.interaction || '',
      physicsDetail: action?.interaction
        ? action.primary + '：' + action.interaction
        : action?.primary || '',
      duration: seg.duration,
      soundEffect: '',
    }
  })
}

function compileLighting(firstSeg?: V3SegmentSpec): { keyLight: string; mood: string } {
  const env = firstSeg?.environment
  return {
    keyLight: env?.lighting || '',
    mood: env?.atmosphere || '',
  }
}

function compileEnvironment(firstSeg?: V3SegmentSpec): { atmosphere: string; colorPalette?: string } {
  const env = firstSeg?.environment
  return {
    atmosphere: env?.atmosphere || '',
    colorPalette: '',
  }
}

function compileStyle(v3: NarrativeConstitutionV3, firstSeg?: V3SegmentSpec): { genre: string; texture: string } {
  const story = v3.storyArc
  const genreHint = story?.setup?.includes('\u53E4') ? '\u53E4\u88C5' :
    story?.setup?.includes('\u4ED9') ? '\u4ED9\u4FA0' :
    story?.setup?.includes('\u60AC') ? '\u60AC\u7591' : ''
  return {
    genre: genreHint,
    texture: '\u7535\u5F71\u7EA7',
  }
}

function compileConstraints(v3: NarrativeConstitutionV3): {
  continuity: string[]
  physics: string[]
  identity: string[]
  spatial: string[]
  temporal: string[]
  cameraSafety: string[]
  visibility: string[]
} {
  const constraints = {
    continuity: [] as string[],
    physics: [] as string[],
    identity: [] as string[],
    spatial: [] as string[],
    temporal: [] as string[],
    cameraSafety: [] as string[],
    visibility: [] as string[],
  }

  // 从 V3 角色的 appearance 推导 identity 约束
  for (const char of v3.characters) {
    if (char.appearance) {
      constraints.identity.push(char.name + '：' + (char.appearance?.slice(0, 50) || ''))
    }
  }

  // 从 V3 场景的 lighting/weather 推导 spatial 约束
  for (const scene of v3.scenes) {
    if (scene.environment?.lighting) {
      constraints.spatial.push('\u573A\u666F ' + scene.name + ' \u7167\u660E\uFF1A' + scene.environment.lighting)
    }
  }

  // temporal: 从 segment 编号推导
  if (v3.segments.length > 1) {
    constraints.temporal.push(
      '\u6BB5\u843D\u987A\u5E8F ' + v3.segments[0].segmentNumber + ' \u2192 ' +
      v3.segments[v3.segments.length - 1].segmentNumber + ' \u4FDD\u6301\u65F6\u95F4\u8FDE\u7EED'
    )
  }

  // visibility: 低聚焦角色避免遮挡
  const lowFocusChars = v3.segments
    .flatMap(s => s.characters || [])
    .filter(p => p.focus !== undefined && p.focus < 0.3)
  if (lowFocusChars.length > 3) {
    constraints.visibility.push('\u4F4E\u805A\u7126\u89D2\u8272\u907F\u514D\u906E\u6321\u5173\u952E\u89D2\u8272')
  }

  return constraints
}
