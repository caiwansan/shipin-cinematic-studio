/**
 * build-shot-graph.ts — Shot Segmentation Engine
 *
 * 核心转换：Narrative Description → Shot Graph
 *
 * 规则引擎（4 条）：
 *   1. Scene Partitioning — 检测场景变化切分 shot
 *   2. Action Atomicity — 每个 shot 只能有一个连续动作
 *   3. Camera Stability — 单 shot 单镜头
 *   4. Spatial Lock — 每个 shot 绑定唯一空间
 */

import type { ShotGraph, ShotNode, ShotIntent } from './shot-graph-schema.js'

// ============================================================
// Intent Detection — 从文本推断镜头意图
// ============================================================

const INTENT_PATTERNS: { intent: ShotIntent; patterns: RegExp[] }[] = [
  {
    intent: 'establishing',
    patterns: [
      /俯瞰|全景|远眺|鸟瞰|尽收眼底|广阔|辽阔|绵延|延展|远处|天际|地平线|大地|山川|森林|大海|沙漠|城市|战场/,
    ],
  },
  {
    intent: 'reveal',
    patterns: [
      /出现|现身|浮现|显出|露出|显现|走出|跨入|登场|走进|出现在|闪出/,
    ],
  },
  {
    intent: 'confrontation',
    patterns: [
      /对峙|对视|相望|面对面|对望|相峙|凝视|注视|盯着|互看/,
    ],
  },
  {
    intent: 'action',
    patterns: [
      /冲锋|奔跑|追逐|挥舞|斩|劈|刺|砍|追击|飞跃|腾空|闪避|格挡|周旋|缠斗/,
    ],
  },
  {
    intent: 'impact',
    patterns: [
      /撞击|碰撞|爆炸|炸裂|崩碎|碎裂|轰|震|倒飞|击飞|吐血|迸溅/,
    ],
  },
  {
    intent: 'climax',
    patterns: [
      /汇聚|爆发|释放|终极|绝杀|逆转|觉醒|突破|升华|高潮|凝聚|冲破/,
    ],
  },
  {
    intent: 'ending',
    patterns: [
      /落幕|消散|归于|化为|飘零|余音|凝视|远去|遗留|残|静|安/,
    ],
  },
]

function detectIntent(text: string): ShotIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(text))) return intent
  }
  return 'reveal'
}

// ============================================================
// Camera Detection — 从文本抽取镜头参数
// ============================================================

interface CameraDetectResult {
  type: string
  movement?: string
}

const CAMERA_TYPE_PATTERNS: [RegExp, string][] = [
  [/俯瞰|鸟瞰|航拍|俯拍|aerial/i, 'aerial wide shot'],
  [/仰拍|仰视|low.?angle/i, 'low-angle'],
  [/特写|脸部|close.?up|extreme/i, 'close-up'],
  [/全景|远景|wide|establish/i, 'wide shot'],
  [/过肩|over.?shoulder/i, 'over-shoulder'],
  [/中景|medium/i, 'medium shot'],
  [/主观|第一人称|POV|第一视角/i, 'subjective shot'],
]

const CAMERA_MOVEMENT_PATTERNS: [RegExp, string][] = [
  [/推|push.?in/i, 'slow push-in'],
  [/拉|pull.?out/i, 'slow pull-out'],
  [/环绕|orbit|旋转/i, 'orbit'],
  [/跟|track|追随|跟随/i, 'smooth tracking'],
  [/摇|pan|横摇/i, 'panning'],
  [/升|升降|crane|升起/i, 'crane up'],
  [/晃|手持|shake|handheld|抖动/i, 'handheld shake'],
  [/静态|固定|static|fixed|locked/i, 'static'],
]

function detectCamera(text: string): CameraDetectResult {
  let type = 'wide shot'
  for (const [pattern, result] of CAMERA_TYPE_PATTERNS) {
    if (pattern.test(text)) { type = result; break }
  }

  let movement: string | undefined
  for (const [pattern, result] of CAMERA_MOVEMENT_PATTERNS) {
    if (pattern.test(text)) { movement = result; break }
  }

  return { type, movement }
}

// ============================================================
// VFX Detection — 从文本抽取特效
// ============================================================

type VFXTransform = (desc: string) => string
const VFX_PATTERNS: [RegExp, VFXTransform][] = [
  // 能量特效
  [/剑气|刀芒|光晕|光环|能量|aura|光柱|光波|极光/,
   (desc) => `energy: ${desc} energy radiating from source`],
  // 粒子特效
  [/火花|火星|烟雾|烟尘|尘埃|粉尘|雪花|碎片|粒子|星火|碎屑/,
   (desc) => `particles: ${desc} floating in the environment`],
  // 物理特效
  [/冲击波|震波|波纹|涟漪|风压|气浪|shockwave|ripple/,
   (desc) => `physics: ${desc} expanding outward from impact`],
  // 光线
  [/光线|光束|光柱|光影|阴影|照明|闪烁|闪光|辉光|bloom|glow/,
   (desc) => `lighting: ${desc} illuminating the scene`],
  // 爆炸
  [/爆炸|爆裂|炸裂|碎裂|崩碎|倒塌|坍塌|flammable|explosion/,
   (desc) => `physics: ${desc} violently dispersing`],
  // 慢动作
  [/慢动作|slow.?motion|time.?dilation/,
   () => `time: slow motion effect applied to action`],
]

function detectVFX(text: string): string[] {
  const vfx: string[] = []
  for (const [pattern, transform] of VFX_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      vfx.push(transform(match[0]))
    }
  }
  return [...new Set(vfx)]
}

// ============================================================
// Scene Partitioning — 按场景变化切分段
// ============================================================

function calculateSceneAnchor(line: string): string {
  // 提取最独特的空间定位词
  const anchors = line.match(/在[^，。,.\s]{2,20}(?:上|下|里|内|外|中|前|后|旁|边|处)/)
  if (anchors) return anchors[0].replace(/在/, '')

  // 提取场景名词
  const scenes = line.match(
    /(?:战场|废墟|宫殿|洞穴|森林|荒原|沙漠|海岸|街道|寺庙|大厅|庭院|山坡|山顶|山谷|城池|祭坛|结界|天空|水面|岩浆|冰原|雪地|城墙)/
  )
  if (scenes) return scenes[0]

  return 'default scene'
}

function splitByScenes(paragraphs: string[]): { text: string; scene: string }[] {
  const segments: { text: string; scene: string }[] = []

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    const scene = calculateSceneAnchor(trimmed)

    // 按标点拆分子句
    const clauses = trimmed.split(/[。！？；]/).filter(c => c.trim().length > 0)

    for (const clause of clauses) {
      const clauseScene = calculateSceneAnchor(clause)
      segments.push({ text: clause.trim(), scene: clauseScene || scene })
    }
  }

  // 合并相邻同景句子
  const merged: typeof segments = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (last && last.scene === seg.scene) {
      last.text += '。' + seg.text
    } else {
      merged.push({ ...seg })
    }
  }

  return merged
}

// ============================================================
// Action Atomicity — 拆分多动作
// ============================================================

function splitAtomicActions(text: string): string[] {
  const connectors = /(?:然后|接着|随后|同时|与此同时|下一秒|瞬间|随即|紧跟着|紧接着)/g

  // 找出连接词位置来分段
  const segments: string[] = []
  let lastEnd = 0

  let match: RegExpExecArray | null
  while ((match = connectors.exec(text)) !== null) {
    const segment = text.slice(lastEnd, match.index).trim()
    if (segment.length > 3) segments.push(segment)
    lastEnd = match.index
  }

  const lastSegment = text.slice(lastEnd).trim()
  if (lastSegment.length > 3) segments.push(lastSegment)

  // 如果没拆分成功，用更暴力方案：按较短段落拆
  if (segments.length <= 1 && text.length > 40) {
    // 按动作动词拆分
    const verbSplit = text.split(/(?<=[挨踹受破爆炸轰摔跌撞击追逃飞跳跃扑闪滚翻踢打砍斩劈刺])/)
    if (verbSplit.length > 1) {
      let buf = ''
      for (const chunk of verbSplit) {
        if ((buf + chunk).length > 20) {
          segments.push(buf.trim())
          buf = chunk
        } else {
          buf += chunk
        }
      }
      if (buf.trim()) segments.push(buf.trim())
    }
  }

  if (segments.length === 0) segments.push(text)
  return segments.map(s => s.trim()).filter(s => s.length > 0)
}

// ============================================================
// Main: buildShotGraph
// ============================================================

export function buildShotGraph(narrative: string): ShotGraph {
  // Step 1: 分段 — 按段落拆
  const paragraphs = narrative.split(/\n+/).filter(p => p.trim().length > 0)

  // Step 2: Scene Partitioning
  const sceneSegments = splitByScenes(paragraphs)

  // Step 3: 每个 seg 产生一个或多个 shot
  const shots: ShotNode[] = []
  let shotCounter = 0

  for (const seg of sceneSegments) {
    const intent = detectIntent(seg.text)
    const camera = detectCamera(seg.text)
    const vfx = detectVFX(seg.text)

    // Step 4: Action Atomicity — 拆多动作
    const actionSegments = splitAtomicActions(seg.text)

    for (const actionText of actionSegments) {
      shotCounter++
      const shotIntent = actionSegments.length > 1 ? (detectIntent(actionText) || intent) : intent

      // Step 5: 提取主体
      const subjects = extractSubjects(actionText)

      // Step 6: 清理动作文本（去除非动作描述）
      const cleanAction = cleanupAction(actionText)

      const shot: ShotNode = {
        id: `S${String(shotCounter).padStart(2, '0')}`,
        intent: shotIntent,
        spatialFrame: seg.scene,
        camera,
        subject: subjects.length > 0 ? subjects : ['character'],
        action: cleanAction,
        vfx,
        continuity: shotCounter > 1 ? {
          previousRelation: sameScene(seg.scene, sceneSegments, shotCounter - 2) ? 'same-scene' : 'cut',
          description: `from previous shot S${String(shotCounter - 1).padStart(2, '0')}`,
        } : undefined,
      }

      shots.push(shot)
    }
  }

  return {
    shots,
    meta: {
      totalShots: shots.length,
      narrativeSummary: narrative.slice(0, 80) + (narrative.length > 80 ? '...' : ''),
    },
  }
}

// ============================================================
// Helpers
// ============================================================

function extractSubjects(text: string): string[] {
  const subjects: string[] = []

  // 提取角色标记
  const rolePatterns = [
    /(?:白发|黑衣|红衣|蓝衣|紫衣|金甲|银甲|铠甲|华服|长袍|盔甲|斗篷|披风|赤膊|赤脚|头盔)\S{0,6}(?:男子|女子|战士|将军|剑客|法师|少年|少女|老者|妖|怪|魔|仙|神)/g,
    /(?:妖|魔|怪|仙|神|龙|虎|狼|凤凰|麒麟|鲲鹏)\S{0,4}(?:王|将|兵|主|皇|帝)/g,
  ]

  for (const pattern of rolePatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      subjects.push(match[0])
    }
  }

  // 简单主体的提取
  if (subjects.length === 0) {
    const simplePatterns = [
      /(?:他|她|它|他们|她们)(?=[^，。,.\s]{0,4}(?:拔出|举起|冲向|挥动|释放|爆发出|凝聚))/,
      /(?:(?:一)?个|这位|那位|这群|那群)\S{0,6}(?:男子|女子|战士|将军|妖兽|生物|身影)/,
    ]
    for (const pattern of simplePatterns) {
      const match = text.match(pattern)
      if (match) subjects.push(match[0])
    }
  }

  return [...new Set(subjects)]
}

function cleanupAction(text: string): string {
  return text
    .replace(/^镜头(?:从|以|自|由|向|对)/, '')
    .replace(/^画面(?:中|里|内|从|以)/, '')
    .replace(/^摄影机/, '')
    .replace(/^(?:推|拉|摇|移|跟|升|降|固定|环绕|俯拍|仰拍|航拍|鸟瞰)/, '')
    .replace(/^(?:特写|近景|中景|全景|远景|过肩)/, '')
    .replace(/\s*[。，！？；]\s*$/, '')
    .trim()
}

function sameScene(currentScene: string, allSegments: { text: string; scene: string }[], prevIndex: number): boolean {
  if (prevIndex < 0 || prevIndex >= allSegments.length) return false
  return currentScene === allSegments[prevIndex].scene
}
