/**
 * director-runtime/plan-generator.ts
 *
 * ⚔️ Phase 2 Implementation — DirectorPlan Generator（模板化）
 *
 * 输入：User Intent
 * 输出：DirectorPlan
 *
 * 规则：
 *   - keyword → template mapping
 *   - deterministic output
 *   - no semantic understanding
 *   - no AI
 *
 * 当前实现：
 *   1. 预定义模板（按关键词匹配）
 *   2. 默认模板（fallback）
 *   3. 所有输出都是同一输入下可重复的
 */

import type { DirectorInput, DirectorPlan, NarrativeGraph, NarrativeNode, NarrativeEdge } from './types.js'

// ── 模板定义 ──

interface NarrativeTemplate {
  narrativeIntent: string
  emotionalArc: string[]
  sceneSegmentation: Array<{
    id: string
    narrativePurpose: string
    emotionalTone: string
    summary: string
  }>
  narrativeLogic: {
    causeEffectGraph: string[]
    tensionFlow: string[]
    pacingModel: string
  }
  graphHints: {
    eventCount: number
    causalEdges: Array<{ from: number; to: number; relation: NarrativeEdge['relation']; rationale: string }>
  }
  constraints: {
    pacing: 'slow' | 'normal' | 'fast'
    climaxPosition: number
    themeKeywords: string[]
  }
}

// ── 模板库 ──

const TEMPLATES: Record<string, NarrativeTemplate> = {
  '灾难': {
    narrativeIntent: '展现人类在极端灾难面前的求生意志与彼此扶持',
    emotionalArc: ['平静', '不安', '恐惧', '挣扎', '希望'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '建立日常，埋下危机伏笔', emotionalTone: '平静', summary: '灾难前最后的日常场景' },
      { id: 'B', narrativePurpose: '灾难降临，冲击感', emotionalTone: '恐惧', summary: '灾难突然降临，主角陷入恐慌' },
      { id: 'C', narrativePurpose: '求生过程，展现意志', emotionalTone: '挣扎', summary: '主角在灾难中努力存活' },
      { id: 'D', narrativePurpose: '转折突破', emotionalTone: '紧张', summary: '主角找到生机，但挑战未结束' },
      { id: 'E', narrativePurpose: '结局，传达希望', emotionalTone: '希望', summary: '灾难过后，黎明到来' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['日常 → 灾难降临', '灾难降临 → 求生', '求生 → 转折', '转折 → 希望'],
      tensionFlow: ['位置0.00→平静', '位置0.20→不安', '位置0.35→恐惧', '位置0.55→挣扎', '位置0.75→紧张', '位置0.90→希望'],
      pacingModel: '开场平缓，灾难后急剧加速，中段维持高张力，结尾逐渐回落',
    },
    graphHints: {
      eventCount: 8,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '日常场景暗示即将到来的灾难' },
        { from: 1, to: 2, relation: 'causes', rationale: '灾难迫使主角行动' },
        { from: 2, to: 3, relation: 'enables', rationale: '求生行为带来转折' },
        { from: 3, to: 4, relation: 'resolves', rationale: '转折推动解决' },
      ],
    },
    constraints: { pacing: 'fast', climaxPosition: 0.75, themeKeywords: ['灾难', '求生', '希望'] },
  },

  '爱情': {
    narrativeIntent: '讲述两个灵魂从相遇、相知到面临抉择的内心历程',
    emotionalArc: ['孤独', '好奇', '心动', '甜蜜', '矛盾', '释然'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '各自生活，暗示缺憾', emotionalTone: '孤独', summary: '相遇前各自的生活状态' },
      { id: 'B', narrativePurpose: '初次相遇，产生好奇', emotionalTone: '心动', summary: '两人在某个场合第一次遇见' },
      { id: 'C', narrativePurpose: '情感升温', emotionalTone: '甜蜜', summary: '甜蜜的相处时光' },
      { id: 'D', narrativePurpose: '矛盾出现', emotionalTone: '矛盾', summary: '外部压力或内心冲突浮现' },
      { id: 'E', narrativePurpose: '抉择与释然', emotionalTone: '释然', summary: '面对选择，最终释然' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['孤独 → 相遇', '相遇 → 心动', '心动 → 甜蜜', '甜蜜 → 矛盾', '矛盾 → 释然'],
      tensionFlow: ['位置0.00→孤独', '位置0.15→好奇', '位置0.30→心动', '位置0.50→甜蜜', '位置0.70→矛盾', '位置0.90→释然'],
      pacingModel: '整体平缓，中段甜蜜区最松弛，后段矛盾区略微收紧，结尾舒缓',
    },
    graphHints: {
      eventCount: 7,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '孤独促使主角向外探索' },
        { from: 1, to: 2, relation: 'enables', rationale: '相遇为情感发展创造条件' },
        { from: 2, to: 3, relation: 'causes', rationale: '情感发展自然带来矛盾' },
        { from: 3, to: 4, relation: 'resolves', rationale: '矛盾推动最终抉择' },
      ],
    },
    constraints: { pacing: 'slow', climaxPosition: 0.70, themeKeywords: ['爱情', '成长', '选择'] },
  },

  '悬疑': {
    narrativeIntent: '通过层层递进的线索和反转，让观众体验到抽丝剥茧的解谜过程',
    emotionalArc: ['平静', '疑惑', '不安', '紧张', '震惊', '顿悟'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '案件或异常事件出现', emotionalTone: '疑惑', summary: '一个不寻常的事件发生' },
      { id: 'B', narrativePurpose: '调查展开，线索浮现', emotionalTone: '不安', summary: '主角开始调查，发现可疑线索' },
      { id: 'C', narrativePurpose: '深入调查，危险逼近', emotionalTone: '紧张', summary: '调查越深入，越接近危险' },
      { id: 'D', narrativePurpose: '反转揭示', emotionalTone: '震惊', summary: '真相出乎所有人意料' },
      { id: 'E', narrativePurpose: '结局说明', emotionalTone: '顿悟', summary: '一切线索闭合，真相大白' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['异常 → 调查', '调查 → 线索', '线索 → 深入', '深入 → 反转', '反转 → 闭合'],
      tensionFlow: ['位置0.00→平静', '位置0.15→疑惑', '位置0.35→不安', '位置0.55→紧张', '位置0.75→震惊', '位置0.90→顿悟'],
      pacingModel: '开场平和，疑惑后逐步加速，恐惧区高张力维持到反转，结尾急速回落',
    },
    graphHints: {
      eventCount: 9,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '异常事件触发调查动机' },
        { from: 1, to: 2, relation: 'enables', rationale: '调查过程中发现线索' },
        { from: 2, to: 3, relation: 'causes', rationale: '线索指向更深的危险' },
        { from: 3, to: 4, relation: 'resolves', rationale: '深入调查导致反转' },
        { from: 4, to: 5, relation: 'resolves', rationale: '反转后真相闭合' },
      ],
    },
    constraints: { pacing: 'fast', climaxPosition: 0.75, themeKeywords: ['悬疑', '线索', '反转'] },
  },

  '古装': {
    narrativeIntent: '展现古代世界中的恩怨情仇与家国大义',
    emotionalArc: ['安宁', '暗涌', '冲突', '悲壮', '升华'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '太平盛世，伏笔暗藏', emotionalTone: '安宁', summary: '描绘时代背景' },
      { id: 'B', narrativePurpose: '矛盾浮现', emotionalTone: '暗涌', summary: '隐藏的冲突开始显露' },
      { id: 'C', narrativePurpose: '正面对抗', emotionalTone: '悲壮', summary: '冲突爆发，奋力一搏' },
      { id: 'D', narrativePurpose: '结局升华', emotionalTone: '升华', summary: '成败已定，精神长存' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['安宁 → 暗涌', '暗涌 → 冲突', '冲突 → 悲壮', '悲壮 → 升华'],
      tensionFlow: ['位置0.00→安宁', '位置0.25→暗涌', '位置0.50→冲突', '位置0.75→悲壮', '位置0.90→升华'],
      pacingModel: '开场舒缓，中段逐渐加速，冲突区达到张力峰值，结局升华放缓',
    },
    graphHints: {
      eventCount: 6,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '太平之下暗流涌动' },
        { from: 1, to: 2, relation: 'causes', rationale: '暗流积累导致正面冲突' },
        { from: 2, to: 3, relation: 'resolves', rationale: '冲突的结果升华主题' },
      ],
    },
    constraints: { pacing: 'normal', climaxPosition: 0.60, themeKeywords: ['古装', '家国', '大义'] },
  },

  '科幻': {
    narrativeIntent: '在未来科技的背景下，探讨科技与人性的边界',
    emotionalArc: ['好奇', '惊叹', '不安', '危机', '抉择', '思考'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '展现未来科技世界', emotionalTone: '好奇', summary: '令人惊叹的未来科技日常' },
      { id: 'B', narrativePurpose: '科技带来的隐患', emotionalTone: '不安', summary: '科技发展背后的阴影' },
      { id: 'C', narrativePurpose: '危机爆发', emotionalTone: '危机', summary: '科技失控，危机降临' },
      { id: 'D', narrativePurpose: '主角的抉择', emotionalTone: '抉择', summary: '面对科技与人性的抉择' },
      { id: 'E', narrativePurpose: '结局与思考', emotionalTone: '思考', summary: '危机过后，留下思考' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['科技展示 → 隐患浮现', '隐患 → 危机', '危机 → 抉择', '抉择 → 深思'],
      tensionFlow: ['位置0.00→好奇', '位置0.20→惊叹', '位置0.40→不安', '位置0.55→危机', '位置0.75→抉择', '位置0.90→思考'],
      pacingModel: '开场缓缓展开世界观，隐患区开始收紧，危机区达到最高张力，结局放缓为沉思节奏',
    },
    graphHints: {
      eventCount: 8,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '科技进步带来隐患' },
        { from: 1, to: 2, relation: 'causes', rationale: '隐患积累导致危机' },
        { from: 2, to: 3, relation: 'enables', rationale: '危机迫使主角做出抉择' },
        { from: 3, to: 4, relation: 'resolves', rationale: '抉择带来思考' },
      ],
    },
    constraints: { pacing: 'normal', climaxPosition: 0.65, themeKeywords: ['科幻', '科技', '人性'] },
  },

  '冒险': {
    narrativeIntent: '跟随主角的脚步，经历一场充满未知和挑战的惊险旅程',
    emotionalArc: ['期待', '兴奋', '紧张', '危机', '突破', '成就'],
    sceneSegmentation: [
      { id: 'A', narrativePurpose: '出发的召唤', emotionalTone: '期待', summary: '主角踏上冒险旅程' },
      { id: 'B', narrativePurpose: '初步挑战', emotionalTone: '兴奋', summary: '遇到第一个挑战并克服' },
      { id: 'C', narrativePurpose: '深入险境', emotionalTone: '紧张', summary: '冒险进入更危险的区域' },
      { id: 'D', narrativePurpose: '生死危机', emotionalTone: '危机', summary: '遭遇最大危机，生死一线' },
      { id: 'E', narrativePurpose: '最终突破', emotionalTone: '成就', summary: '突破困境，达成目标' },
    ],
    narrativeLogic: {
      causeEffectGraph: ['召唤 → 出发', '出发 → 挑战', '挑战 → 深入', '深入 → 危机', '危机 → 突破'],
      tensionFlow: ['位置0.00→期待', '位置0.15→兴奋', '位置0.35→紧张', '位置0.55→危机', '位置0.80→突破', '位置0.95→成就'],
      pacingModel: '开场兴奋，逐步加速，危机区达到峰值，突破后急速释放',
    },
    graphHints: {
      eventCount: 8,
      causalEdges: [
        { from: 0, to: 1, relation: 'causes', rationale: '冒险召唤触发行动' },
        { from: 1, to: 2, relation: 'enables', rationale: '初步挑战为深入做准备' },
        { from: 2, to: 3, relation: 'causes', rationale: '深入险境必然带来更大的危机' },
        { from: 3, to: 4, relation: 'resolves', rationale: '生死危机逼迫突破' },
      ],
    },
    constraints: { pacing: 'fast', climaxPosition: 0.80, themeKeywords: ['冒险', '突破', '成长'] },
  },
}

// ── 默认模板（fallback） ──

const DEFAULT_TEMPLATE: NarrativeTemplate = {
  narrativeIntent: '讲述一个完整的故事，让观众体验角色的情感变化',
  emotionalArc: ['平静', '波动', '转折', '高潮', '收束'],
  sceneSegmentation: [
    { id: 'A', narrativePurpose: '故事开场，建立背景', emotionalTone: '平静', summary: '故事的起点' },
    { id: 'B', narrativePurpose: '情节推进', emotionalTone: '波动', summary: '故事向前推进' },
    { id: 'C', narrativePurpose: '转折点', emotionalTone: '转折', summary: '关键转折出现' },
    { id: 'D', narrativePurpose: '高潮', emotionalTone: '高潮', summary: '故事最高潮' },
    { id: 'E', narrativePurpose: '结局收束', emotionalTone: '收束', summary: '故事的结局' },
  ],
  narrativeLogic: {
    causeEffectGraph: ['开场 → 推进', '推进 → 转折', '转折 → 高潮', '高潮 → 结局'],
    tensionFlow: ['位置0.00→平静', '位置0.25→波动', '位置0.50→转折', '位置0.75→高潮', '位置0.90→收束'],
    pacingModel: '开场平缓，逐步加速至高潮，结尾回落',
  },
  graphHints: {
    eventCount: 6,
    causalEdges: [
      { from: 0, to: 1, relation: 'causes', rationale: '开场事件推动情节发展' },
      { from: 1, to: 2, relation: 'causes', rationale: '情节积累导致转折' },
      { from: 2, to: 3, relation: 'causes', rationale: '转折引向高潮' },
      { from: 3, to: 4, relation: 'resolves', rationale: '高潮导向结局' },
    ],
  },
  constraints: { pacing: 'normal', climaxPosition: 0.75, themeKeywords: ['故事', '叙事'] },
}

// ── 关键词匹配 ──

function matchTemplate(input: string): NarrativeTemplate {
  const lower = input.toLowerCase()

  for (const [keyword, template] of Object.entries(TEMPLATES)) {
    if (lower.includes(keyword)) {
      return template
    }
  }

  // 子关键词匹配
  if (lower.includes('末世') || lower.includes('末日') || lower.includes('逃生')) return TEMPLATES['灾难']
  if (lower.includes('恋') || lower.includes('情') || lower.includes('浪漫')) return TEMPLATES['爱情']
  if (lower.includes('侦探') || lower.includes('谜') || lower.includes('推理') || lower.includes('案')) return TEMPLATES['悬疑']
  if (lower.includes('古代') || lower.includes('江湖') || lower.includes('宫') || lower.includes('王朝')) return TEMPLATES['古装']
  if (lower.includes('未来') || lower.includes('太空') || lower.includes('AI') || lower.includes('机器人')) return TEMPLATES['科幻']
  if (lower.includes('探险') || lower.includes('寻找') || lower.includes('旅程') || lower.includes('勇')) return TEMPLATES['冒险']

  return DEFAULT_TEMPLATE
}

// ── 生成器 ──

/**
 * generateDirectorPlan — User Intent → DirectorPlan
 *
 * Phase 2 实现：纯模板/规则匹配。
 * 相同输入 → 相同输出（确定性）。
 * 不调 LLM，不做语义理解。
 */
export function generateDirectorPlan(input: DirectorInput): DirectorPlan {
  const template = matchTemplate(input.userIntent)

  // 合并用户约束
  const pacing = input.constraints?.pacing ?? template.constraints.pacing
  const userKeywords = input.constraints?.mood
    ? [input.constraints.mood]
    : []

  return {
    narrativeIntent: template.narrativeIntent,
    emotionalArc: template.emotionalArc,
    sceneSegmentation: template.sceneSegmentation.map(s => ({ ...s })),
    narrativeLogic: {
      causeEffectGraph: [...template.narrativeLogic.causeEffectGraph],
      tensionFlow: [...template.narrativeLogic.tensionFlow],
      pacingModel: template.narrativeLogic.pacingModel,
    },
    narrativeGraph: {
      nodes: [],
      edges: [],
    },
    narrativeConstraints: {
      pacing,
      climaxPosition: template.constraints.climaxPosition,
      themeKeywords: [
        ...template.constraints.themeKeywords,
        ...userKeywords,
      ],
    },
    meta: {
      timestamp: Date.now(),
      inputSource: 'user_text',
      version: '2.1',
    },
  }
}
