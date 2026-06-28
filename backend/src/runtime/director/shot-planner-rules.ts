/**
 * shot-planner-rules.ts — Sprint 1 规则驱动 Shot Planner
 *
 * 根据叙事类型（narrative intent）匹配预定义镜头模板。
 * 规则驱动，不上 AI。
 *
 * 核心原则：
 *   Narrative Intent → ShotNode[]
 *   没有 Camera，没有 VFX，没有 Motion
 */

import type { ShotNode, ShotType, ShotGraph } from './shot-graph-schema.js'

// ============================================================
// 叙事意图检测
// ============================================================

export type NarrativeIntent = 'battle' | 'dialogue' | 'chase' | 'exploration' | 'ritual' | 'journey' | 'default'

const INTENT_PATTERNS: Array<{ intent: NarrativeIntent; patterns: RegExp[] }> = [
  {
    intent: 'battle',
    patterns: [
      /大战|战斗|对决|交锋|厮杀|碰撞|斩|刺|劈|破|攻|防|战|斗|爆/i,
      /attack|battle|fight|war|combat|strike|clash/i,
    ],
  },
  {
    intent: 'dialogue',
    patterns: [
      /说|道|谈|问|答|对话|交流|商议|诉说|骂|吼|喊|叫/i,
      /say|speak|talk|ask|answer|dialogue|conversation/i,
    ],
  },
  {
    intent: 'chase',
    patterns: [
      /追|逃|奔|跑|疾|驰|追赶|逃窜|追击|追逐/i,
      /chase|run|flee|pursue|escape/i,
    ],
  },
  {
    intent: 'exploration',
    patterns: [
      /探索|寻找|搜索|探险|漫步|进入|走向|走近|靠近|逼近/i,
      /explore|search|enter|approach|walk/i,
    ],
  },
  {
    intent: 'ritual',
    patterns: [
      /阵|法|祭|咒|符|印|结|施法|召唤|仪式|布阵|结印|掐诀/i,
      /ritual|summon|cast|spell|formation|incantation/i,
    ],
  },
  {
    intent: 'journey',
    patterns: [
      /行|路|途|游|走|飞|跨越|穿越|旅行|征途|远行|跋涉/i,
      /journey|travel|wander|quest|path|voyage/i,
    ],
  },
]

export function detectNarrativeIntent(narrative: string): NarrativeIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(narrative)) return intent
    }
  }
  return 'default'
}

// ============================================================
// 镜头模板
// ============================================================

export interface ShotTemplate {
  shotType: ShotType
  duration: number
}

const TEMPLATES: Record<NarrativeIntent, ShotTemplate[]> = {
  battle: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'reveal', duration: 2 },
    { shotType: 'reveal', duration: 2 },
    { shotType: 'confrontation', duration: 3 },
    { shotType: 'impact', duration: 2 },
    { shotType: 'action', duration: 3 },
    { shotType: 'climax', duration: 3 },
    { shotType: 'ending', duration: 3 },
  ],
  dialogue: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'dialogue', duration: 4 },
    { shotType: 'dialogue', duration: 4 },
    { shotType: 'ending', duration: 3 },
  ],
  chase: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'action', duration: 3 },
    { shotType: 'action', duration: 3 },
    { shotType: 'impact', duration: 2 },
    { shotType: 'ending', duration: 3 },
  ],
  exploration: [
    { shotType: 'establishing', duration: 4 },
    { shotType: 'reveal', duration: 3 },
    { shotType: 'action', duration: 3 },
    { shotType: 'climax', duration: 3 },
    { shotType: 'ending', duration: 3 },
  ],
  ritual: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'reveal', duration: 2 },
    { shotType: 'confrontation', duration: 3 },
    { shotType: 'climax', duration: 4 },
    { shotType: 'impact', duration: 2 },
    { shotType: 'action', duration: 3 },
    { shotType: 'ending', duration: 3 },
  ],
  journey: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'action', duration: 4 },
    { shotType: 'reveal', duration: 3 },
    { shotType: 'climax', duration: 3 },
    { shotType: 'ending', duration: 4 },
  ],
  default: [
    { shotType: 'establishing', duration: 3 },
    { shotType: 'reveal', duration: 3 },
    { shotType: 'confrontation', duration: 3 },
    { shotType: 'ending', duration: 3 },
  ],
}

// ============================================================
// 主体/环境/动作提取（简单关键词匹配，纯规则）
// ============================================================

/** 提取 narrative 中的角色名（简单规则：关键词前后词组） */
function extractSubjects(narrative: string): string[] {
  // 常见角色后缀/前缀
  const rolePattern = /(.{2,6}(神|魔|尊|王|帝|仙|妖|怪|人|者|士|师|徒|兄|弟|姐|妹|主|公|子))/g
  const matches = [...narrative.matchAll(rolePattern)]
    .map(m => m[1].trim())
    .filter((v, i, a) => a.indexOf(v) === i)
  if (matches.length > 0) return matches.slice(0, 4)
  // fallback：取前两个有意义的双字词
  const words = narrative.match(/[\u4e00-\u9fff]{2,4}/g) || []
  return [...new Set(words)].slice(0, 3)
}

/** 提取环境描述 */
function extractEnvironment(narrative: string): string {
  const envPattern = /(.{2,10}(山|谷|崖|海|天|地|殿|宫|城|林|洞|湖|河|原|野|空|界|境|域|塔|楼|台|阁))/g
  const matches = [...narrative.matchAll(envPattern)]
  if (matches.length > 0) return matches[0][1].trim()
  return '未知战场'
}

/** 提取核心动作 */
function extractCoreAction(narrative: string, intent: NarrativeIntent): string {
  switch (intent) {
    case 'battle':
      return '双方展开激烈交锋'
    case 'dialogue':
      return '双方进行对话'
    case 'chase':
      return '一方追逐另一方'
    case 'exploration':
      return '探索周围环境'
    case 'ritual':
      return '施展法术仪式'
    case 'journey':
      return '踏上征途'
    default:
      return '场面展开'
  }
}

/** 根据 shotType 生成具体动作描述 */
function generateAction(shotType: ShotType, narrative: string, intent: NarrativeIntent): string {
  switch (shotType) {
    case 'establishing':
      return '展现宏大场景，交代环境'
    case 'reveal':
      return '关键角色/物体亮相'
    case 'dialogue':
      return '双方对话交流'
    case 'confrontation':
      return '双方对峙，蓄势待发'
    case 'action':
      return '动作爆发，激烈交锋'
    case 'impact':
      return '决定性碰撞瞬间'
    case 'climax':
      return '高潮转折，局势逆转'
    case 'ending':
      return '收尾，留有回响'
  }
}

// ============================================================
// 核心：生成 Shot Plan
// ============================================================

export function generateShotPlan(narrative: string): ShotGraph {
  const intent = detectNarrativeIntent(narrative)
  const template = TEMPLATES[intent]
  const subjects = extractSubjects(narrative)
  const environment = extractEnvironment(narrative)
  const coreAction = extractCoreAction(narrative, intent)

  const shots: ShotNode[] = template.map((t, i) => {
    const id = String(i + 1).padStart(3, '0')
    return {
      id,
      shotType: t.shotType,
      subject: subjects,
      environment,
      action: generateAction(t.shotType, narrative, intent),
      duration: t.duration,
    }
  })

  return {
    shots,
    meta: {
      totalShots: shots.length,
      narrativeSummary: narrative.slice(0, 100),
    },
  }
}
