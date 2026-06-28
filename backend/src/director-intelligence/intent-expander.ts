/**
 * director-intelligence/intent-expander.ts
 *
 * ⚔️ Phase 3 — Intent Expansion Engine（语义扩展）
 *
 * 职责：
 *   将用户原始 Intent 扩展为更丰富的叙事意图描述。
 *
 * 规则：
 *   - 同义扩展（不改变核心意图）
 *   - 情绪增强（添加情绪维度）
 *   - 结构补全（补充缺失的叙事要素）
 *   - ❌ 禁止视觉推断
 *   - ❌ 禁止场景生成
 *   - ❌ 禁止 prompt/视觉字段
 *
 * Phase 3 实现：纯规则扩展（不调 LLM）
 * 后续可升级为 LLM 生成，通过 sampler 控制随机性。
 */

// ── 扩展策略 ──

export interface ExpansionResult {
  /** 扩展后的 intent 文本 */
  enhancedIntent: string
  /** 情绪标签扩展 */
  moodTags: string[]
  /** 节奏倾向扩展 */
  paceTags: string[]
  /** 扩展元数据 */
  meta: {
    expansions: string[]
    appliedStrategies: ExpansionStrategy[]
  }
}

type ExpansionStrategy = 'synonym' | 'emotional_amplify' | 'structural_complete'

// ── 同义扩展库 ──

const INTENT_EXPANSIONS: Record<string, { synonym: string; mood: string[]; pace?: string }> = {
  '灾难': { synonym: '人类在极端灾难面前的求生意志与彼此扶持', mood: ['恐惧', '希望'], pace: 'fast' },
  '爱情': { synonym: '两个灵魂从相遇、相知到面临抉择的内心历程', mood: ['心动', '甜蜜', '矛盾'], pace: 'slow' },
  '悬疑': { synonym: '层层递进的线索和反转，抽丝剥茧的解谜过程', mood: ['疑惑', '紧张', '震惊'], pace: 'fast' },
  '古装': { synonym: '古代世界中的恩怨情仇与家国大义', mood: ['安宁', '悲壮', '升华'], pace: 'normal' },
  '科幻': { synonym: '未来科技背景下，科技与人性的边界探索', mood: ['好奇', '不安', '思考'], pace: 'normal' },
  '冒险': { synonym: '充满未知和挑战的惊险旅程', mood: ['兴奋', '紧张', '成就'], pace: 'fast' },
  '成长': { synonym: '主角从青涩到成熟的蜕变历程', mood: ['迷茫', '挣扎', '释然'], pace: 'slow' },
  '战争': { synonym: '战火中的生死抉择与人性的光辉', mood: ['紧张', '悲壮', '希望'], pace: 'fast' },
  '喜剧': { synonym: '啼笑皆非的误会与温暖人心的结局', mood: ['欢乐', '温暖'], pace: 'fast' },
  '奇幻': { synonym: '魔法世界中的奇遇与内心力量的觉醒', mood: ['惊奇', '勇气'], pace: 'normal' },
}

// ── 情绪增强映射 ──

const EMOTIONAL_AMPLIFIERS: Record<string, string[]> = {
  '恐惧': ['压迫感', '不安', '危机四伏'],
  '希望': ['温暖', '信念', '曙光'],
  '心动': ['温暖', '悸动', '美好'],
  '甜蜜': ['温馨', '幸福', '满足'],
  '矛盾': ['纠结', '痛苦', '挣扎'],
  '疑惑': ['好奇', '探寻', '不解'],
  '紧张': ['压迫', '急切', '危机'],
  '震惊': ['冲击', '震撼', '意外'],
  '悲壮': ['肃穆', '崇高', '感人'],
  '升华': ['超越', '永恒', '伟大'],
  '兴奋': ['激昂', '热烈', '澎湃'],
  '成就': ['自豪', '满足', '自信'],
  '挣扎': ['痛苦', '抗争', '不服'],
  '释然': ['平静', '通透', '解脱'],
}

// ── 结构补全模板 ──

const STRUCTURAL_TEMPLATES: Record<string, string[]> = {
  '灾难': ['在极端环境中', '面对生死考验', '在绝望中寻找'],
  '爱情': ['命运的安排下', '在时光流转中', '跨越障碍的'],
  '悬疑': ['层层迷雾背后', '真相与谎言的交锋', '步步逼近的'],
  '古装': ['家国天下之间', '江山与情义的抉择', '乱世中的'],
  '科幻': ['科技发展的十字路口', '人与机器的边界', '遥远的未来'],
}

// ── Intent 分析 ──

function analyzeIntent(intent: string): { keywords: string[]; moodHint: string | null; structuralTag: string | null } {
  const lower = intent.toLowerCase()
  const keywords: string[] = []
  let moodHint: string | null = null
  let structuralTag: string | null = null

  for (const key of Object.keys(INTENT_EXPANSIONS)) {
    if (lower.includes(key)) {
      keywords.push(key)
    }
  }

  // 情绪提示词
  const moodKeywords = ['恐惧', '希望', '温暖', '悲伤', '快乐', '愤怒', '平静']
  for (const m of moodKeywords) {
    if (lower.includes(m)) {
      moodHint = m
      break
    }
  }

  // 结构标签
  const structureKeywords = ['时间', '空间', '因果', '倒叙', '插叙', '多线']
  for (const s of structureKeywords) {
    if (lower.includes(s)) {
      structuralTag = s
      break
    }
  }

  return { keywords, moodHint, structuralTag }
}

// ── 扩展执行 ──

/**
 * expandIntent — User Intent → Enhanced Intent
 *
 * 执行扩展策略：
 *   1. 同义扩展（基于关键词匹配）
 *   2. 情绪增强（添加情绪维度描述）
 *   3. 结构补全（补充叙事结构描述）
 */
export function expandIntent(userIntent: string): ExpansionResult {
  const analysis = analyzeIntent(userIntent)
  const expansions: string[] = []
  const appliedStrategies: ExpansionStrategy[] = []
  const moodTags: string[] = []
  const paceTags: string[] = []

  let enhanced = userIntent

  // Strategy 1: 同义扩展
  for (const keyword of analysis.keywords) {
    const entry = INTENT_EXPANSIONS[keyword]
    if (entry && entry.synonym) {
      enhanced += `。${entry.synonym}`
      expansions.push(`同义扩展: ${keyword} → ${entry.synonym}`)
      appliedStrategies.push('synonym')

      if (entry.mood) {
        moodTags.push(...entry.mood)
      }
      if (entry.pace) {
        paceTags.push(entry.pace)
      }
    }
  }

  // Strategy 2: 情绪增强
  const emotionBase = analysis.moodHint || moodTags[0]
  if (emotionBase && EMOTIONAL_AMPLIFIERS[emotionBase]) {
    const amps = EMOTIONAL_AMPLIFIERS[emotionBase]
    const ampStr = amps.slice(0, 2).join('、')
    enhanced += ` 情绪维度: ${emotionBase}（${ampStr}）`
    expansions.push(`情绪增强: ${emotionBase} → ${ampStr}`)
    appliedStrategies.push('emotional_amplify')
    if (!moodTags.includes(emotionBase)) {
      moodTags.push(emotionBase)
    }
  }

  // Strategy 3: 结构补全
  for (const keyword of analysis.keywords) {
    const templates = STRUCTURAL_TEMPLATES[keyword]
    if (templates) {
      const structuralDesc = templates[0]
      enhanced += ` 叙事结构: ${structuralDesc}`
      expansions.push(`结构补全: ${keyword} → ${structuralDesc}`)
      appliedStrategies.push('structural_complete')
      break
    }
  }

  return {
    enhancedIntent: enhanced,
    moodTags: [...new Set(moodTags)],
    paceTags: [...new Set(paceTags)],
    meta: {
      expansions,
      appliedStrategies,
    },
  }
}
