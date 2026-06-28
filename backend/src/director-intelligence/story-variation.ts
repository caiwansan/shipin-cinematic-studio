/**
 * director-intelligence/story-variation.ts
 *
 * ⚔️ Phase 3 — Story Variation Engine（叙事变体引擎）
 *
 * 职责：
 *   一个输入 → 多个 DirectorPlan 候选
 *
 * 规则：
 *   - 只改变"故事结构路径"
 *   - 不变 Blueprint mapping compatibility
 *   - 不进入视觉层
 *
 * 变体策略：
 *   1. 情绪路径不同（emotionalArc 变体）
 *   2. 节奏模型不同（pacing 变体）
 *   3. 场景焦点不同（sceneSegmentation 重排）
 *
 * 输出：DirectorPlan 数组（2-3 个），可复现（seed 控制）
 */

import type { DirectorPlan, NarrativeGraph } from '../director-runtime/types.js'
import { buildNarrativeGraph } from '../director-runtime/narrative-graph.js'
import { generateDirectorPlan } from '../director-runtime/plan-generator.js'
import type { DirectorInput } from '../director-runtime/types.js'

// ── 变体参数 ──

export interface VariationConfig {
  /** 生成变体数量（2-3） */
  count: number
  /** 随机种子（保证可复现） */
  seed?: number
  /** 变体强度（0-1） */
  intensity?: number
}

// ── 变体策略 ──

type VariationStrategy = 'emotional_shift' | 'pacing_shift' | 'focus_shift'

interface VariationPlan {
  strategy: VariationStrategy
  description: string
  modify: (plan: DirectorPlan) => DirectorPlan
}

// ── 情绪变体 ──

const EMOTION_ALTERNATIVES: Record<string, string[]> = {
  '恐惧': ['恐慌', '战栗', '窒息'],
  '希望': ['期盼', '信念', '温暖'],
  '平静': ['淡然', '安逸', '平和'],
  '不安': ['忧虑', '焦躁', '忐忑'],
  '挣扎': ['抗拒', '抗争', '不屈'],
  '释然': ['放下', '超脱', '自由'],
  '紧张': ['急迫', '压迫', '紧绷'],
  '感动': ['触动', '共鸣', '震撼'],
  '悲伤': ['哀伤', '忧郁', '沉重'],
  '愤怒': ['愤慨', '激情', '抗争'],
}

// ── 节奏变体 ──

const PACING_ALTERNATIVES: Array<{ pacing: 'slow' | 'normal' | 'fast'; description: string }> = [
  { pacing: 'slow', description: '缓慢积累，细腻铺陈，情感在细节中层层叠加' },
  { pacing: 'normal', description: '稳中有进，张弛有度，控制节奏变换的频率' },
  { pacing: 'fast', description: '急速推进，没有喘息，用节奏制造紧迫感' },
]

// ── 焦点变体 ──

const FOCUS_SHIFTS = [
  '将焦点放在最关键的情感转折点上',
  '突出人物内心世界的变化',
  '强化环境带来的压迫感',
]

// ── 变体生成器 ──

/**
 * generateVariants — DirectorPlan → 变体数组
 *
 * 策略组合：
 *   变体 1: 情绪偏移（emotional_shift）
 *   变体 2: 节奏偏移（pacing_shift）  
 *   变体 3: 焦点偏移（focus_shift）
 */
export function generateVariants(
  plan: DirectorPlan,
  config: VariationConfig = { count: 2 }
): DirectorPlan[] {
  const variants: DirectorPlan[] = []
  const strategies = getStrategies(config)
  const count = Math.min(config.count, strategies.length)

  const usedPacings = new Set<string>()
  usedPacings.add(plan.narrativeConstraints?.pacing ?? 'normal')

  for (let i = 0; i < count; i++) {
    const strategy = strategies[i]
    let variant = deepClone(plan)

    switch (strategy) {
      case 'emotional_shift':
        variant = applyEmotionalShift(variant)
        break
      case 'pacing_shift': {
        const result = applyPacingShift(variant, usedPacings)
        variant = result.plan
        usedPacings.add(result.pacing)
        break
      }
      case 'focus_shift':
        variant = applyFocusShift(variant, i)
        break
    }

    // 更新 meta
    variant.meta = {
      ...variant.meta,
      timestamp: Date.now(),
      version: `2.1.v${i + 1}`,
    }

    // 重建 NarrativeGraph
    variant.narrativeGraph = buildNarrativeGraph(variant)

    variants.push(variant)
  }

  return variants
}

/**
 * getVariants — DirectorInput → DirectorPlan[]（完整链路）
 *
 * 从输入到多个变体的一条龙接口。
 * 先通过 plan-generator 生成基础 plan，再生成变体。
 */
export function getVariants(
  input: DirectorInput,
  config: VariationConfig = { count: 2 }
): DirectorPlan[] {
  const basePlan = generateDirectorPlan(input)
  return generateVariants(basePlan, config)
}

// ── 策略选择 ──

function getStrategies(config: VariationConfig): VariationStrategy[] {
  const strategies: VariationStrategy[] = ['emotional_shift', 'pacing_shift', 'focus_shift']

  // 使用 seed 决定顺序（保证可复现）
  if (config.seed !== undefined) {
    const rng = seededRandom(config.seed)
    // Fisher-Yates shuffle with seeded rng
    for (let i = strategies.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [strategies[i], strategies[j]] = [strategies[j], strategies[i]]
    }
  }

  return strategies
}

// ── 变体应用 ──

function applyEmotionalShift(plan: DirectorPlan): DirectorPlan {
  const newArc = plan.emotionalArc.map(emotion => {
    const alternatives = EMOTION_ALTERNATIVES[emotion]
    if (alternatives) {
      // 取第一个替代
      return alternatives[0]
    }
    return emotion
  })

  return {
    ...plan,
    emotionalArc: newArc,
    sceneSegmentation: plan.sceneSegmentation.map((scene, idx) => ({
      ...scene,
      emotionalTone: idx < newArc.length ? newArc[idx] : scene.emotionalTone,
    })),
    narrativeConstraints: {
      ...(plan.narrativeConstraints ?? { pacing: 'normal', climaxPosition: 0.75, themeKeywords: [] }),
    },
  }
}

function applyPacingShift(
  plan: DirectorPlan,
  usedPacings: Set<string>
): { plan: DirectorPlan; pacing: string } {
  const available = PACING_ALTERNATIVES.filter(p => !usedPacings.has(p.pacing))
  const choice = available.length > 0 ? available[0] : PACING_ALTERNATIVES[0]

  return {
    plan: {
      ...plan,
      narrativeConstraints: {
        ...(plan.narrativeConstraints ?? { pacing: 'normal', climaxPosition: 0.75, themeKeywords: [] }),
        pacing: choice.pacing,
      },
    },
    pacing: choice.pacing,
  }
}

function applyFocusShift(plan: DirectorPlan, index: number): DirectorPlan {
  const focusDesc = FOCUS_SHIFTS[index % FOCUS_SHIFTS.length]

  return {
    ...plan,
    narrativeIntent: `${plan.narrativeIntent}（${focusDesc}）`,
    narrativeConstraints: {
      ...(plan.narrativeConstraints ?? { pacing: 'normal', climaxPosition: 0.75, themeKeywords: [] }),
    },
  }
}

// ── 工具函数 ──

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * seededRandom — 确定性随机数生成器
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
