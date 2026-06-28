/**
 * Scenario Generator v4 — 多版本剧情生成器
 *
 * 基于 Intent Profile 生成多个不同风格的剧情版本。
 * 每个 scenario 是一个完整的情节大纲。
 */

import { IntentProfile } from '../intent-engine-v3/index.js'

export type ScenarioType = 'commercial' | 'emotional' | 'artistic' | 'high_tension'

export interface ScenarioEpisode {
  number: number
  title: string
  description: string
  emotionTarget: number    // -1..1
  tensionLevel: number     // 0-1
  climaxType: 'setup' | 'rising' | 'peak' | 'falling' | 'resolution'
}

export interface Scenario {
  id: string
  type: ScenarioType
  description: string
  emotionCurve: number[]  // 每集情绪值 -1..1
  tensionCurve: number[]  // 每集张力值 0-1
  episodes: ScenarioEpisode[]
  riskLevel: number       // 0-1
  // 元数据
  estimatedCost: number
  targetAudience: string
  keyAppeal: string
}

export interface ScenarioGenerationResult {
  scenarios: Scenario[]
  generationTime: number
  diversity: number       // 0-1: scenarios 之间的差异度
}

const GENRE_TEMPLATES: Record<ScenarioType, {
  description: string
  targetAudience: string
  keyAppeal: string
  riskLevel: number
  emotionPattern: (ep: number, total: number) => number
  tensionPattern: (ep: number, total: number) => number
  episodeTitle: (ep: number) => string
  episodeDesc: (ep: number, total: number) => string
  climaxSchedule: (ep: number, total: number) => ScenarioEpisode['climaxType']
}> = {
  commercial: {
    description: '商业爆款路线 — 强冲突、快节奏、高情感释放',
    targetAudience: '大众观众（18-35岁）',
    keyAppeal: '爽感、反转、高能场面',
    riskLevel: 0.2,
    emotionPattern: (ep, total) => {
      // 情绪起伏大：低落→高潮→低落→更高潮
      const cycle = Math.sin((ep / total) * Math.PI * 2) * 0.3
      const trend = (ep / total) * 0.4
      return Math.max(-1, Math.min(1, cycle + trend - 0.2))
    },
    tensionPattern: (ep, total) => {
      // 张力持续上升，结尾前三集达到峰值
      if (ep >= total - 3 && ep <= total - 1) return 0.9 + Math.random() * 0.1
      return 0.3 + (ep / total) * 0.5
    },
    episodeTitle: (ep) => `${ep === 1 ? '开端' : ep % 3 === 0 ? '危机' : ep % 5 === 0 ? '反转' : '发展'}`,
    episodeDesc: (ep, total) => `第${ep}集${ep === 1 ? '：冲突引入' : ep === total ? '：大结局高潮' : '：剧情推进中'}`,
    climaxSchedule: (ep, total) => {
      if (ep <= 2) return 'setup'
      if (ep === total) return 'resolution'
      if (ep < total / 2) return 'rising'
      if (ep >= total - 2) return 'peak'
      return 'falling'
    },
  },
  emotional: {
    description: '情感细腻路线 — 人物驱动、情绪共鸣、温暖治愈',
    targetAudience: '女性观众（25-45岁）',
    keyAppeal: '代入感、情感治愈、人物成长',
    riskLevel: 0.4,
    emotionPattern: (ep, total) => {
      // 缓慢上升，中间有低谷，结尾温暖
      const progress = ep / total
      const dip = Math.abs(progress - 0.4) < 0.1 ? -0.5 : 0
      return Math.max(-1, Math.min(1, progress * 0.6 - 0.3 + dip))
    },
    tensionPattern: (ep, total) => {
      return 0.2 + (ep / total) * 0.4
    },
    episodeTitle: (ep) => `第${ep}章`,
    episodeDesc: (ep, total) => `情感段落${ep}/${total}`,
    climaxSchedule: (ep, total) => {
      if (ep <= 2) return 'setup'
      if (ep === total) return 'resolution'
      if (total >= 6 && ep === Math.floor(total * 0.4)) return 'peak'
      return 'rising'
    },
  },
  artistic: {
    description: '艺术实验路线 — 非线性叙事、视觉美学、哲学深度',
    targetAudience: '文艺爱好者（22-40岁）',
    keyAppeal: '艺术性、叙事创新、视觉美感',
    riskLevel: 0.7,
    emotionPattern: (ep, total) => {
      // 非线性情绪，追求意外感
      const nonLinear = Math.sin((ep / total) * Math.PI * 3) * 0.5
      return Math.max(-1, Math.min(1, nonLinear))
    },
    tensionPattern: (ep, total) => {
      return Math.sin((ep / total) * Math.PI * 2) * 0.3 + 0.5
    },
    episodeTitle: (ep) => `Segment ${String.fromCharCode(64 + ep)}`,
    episodeDesc: (ep, total) => `非线性片段${ep}/${total}`,
    climaxSchedule: (ep, total) => {
      if (total >= 8 && (ep === 2 || ep === total - 2)) return 'peak'
      return 'rising'
    },
  },
  high_tension: {
    description: '高张力路线 — 悬疑、紧张、极限情绪',
    targetAudience: '悬疑爱好者（20-40岁）',
    keyAppeal: '悬疑张力、反转密集、紧张感',
    riskLevel: 0.6,
    emotionPattern: (ep, total) => {
      // 先压抑后释放
      const pressure = (total - ep) / total
      return Math.max(-1, Math.min(1, -0.5 - pressure * 0.3 + (ep > total * 0.7 ? 0.6 : 0)))
    },
    tensionPattern: (ep, total) => {
      // 持续高压
      return 0.6 + (1 - (total - ep) / total) * 0.3
    },
    episodeTitle: (ep) => `Case ${ep}`,
    episodeDesc: (ep, total) => `紧张升级 ${ep}/${total}`,
    climaxSchedule: (ep, total) => {
      if (ep === total - 1) return 'peak'
      if (ep === total) return 'resolution'
      return 'rising'
    },
  },
}

export class ScenarioGenerator {
  generate(
    intentProfile: IntentProfile,
    totalEpisodes: number,
  ): ScenarioGenerationResult {
    const startTime = Date.now()

    // 根据意图类型决定用哪些 scenarios
    const types: ScenarioType[] = ['commercial', 'emotional']

    // concept 输入增加 artistic 选项
    if (intentProfile.classification.intentType === 'concept') {
      types.push('artistic')
    }

    // full_story 增加 high_tension
    if (intentProfile.classification.intentType === 'full_story') {
      types.push('high_tension')
    }

    // 确保至少 3 个
    if (types.length < 3) types.push('artistic' as ScenarioType)
    if (types.length < 3) types.push('high_tension' as ScenarioType)

    // 如果 > 3 个，取前 3 个
    const selectedTypes = types.slice(0, 3)

    const scenarios: Scenario[] = selectedTypes.map((type, idx) => {
      const template = GENRE_TEMPLATES[type]
      const episodes: ScenarioEpisode[] = []

      for (let ep = 1; ep <= totalEpisodes; ep++) {
        episodes.push({
          number: ep,
          title: template.episodeTitle(ep),
          description: template.episodeDesc(ep, totalEpisodes),
          emotionTarget: template.emotionPattern(ep, totalEpisodes),
          tensionLevel: template.tensionPattern(ep, totalEpisodes),
          climaxType: template.climaxSchedule(ep, totalEpisodes),
        })
      }

      const emotionCurve = episodes.map(e => e.emotionTarget)
      const tensionCurve = episodes.map(e => e.tensionLevel)

      return {
        id: String.fromCharCode(65 + idx), // A, B, C
        type,
        description: template.description,
        emotionCurve,
        tensionCurve,
        episodes,
        riskLevel: template.riskLevel,
        estimatedCost: 10000 + Math.round(Math.random() * 50000),
        targetAudience: template.targetAudience,
        keyAppeal: template.keyAppeal,
      }
    })

    return {
      scenarios,
      generationTime: Date.now() - startTime,
      diversity: 0.7,   // 预期差异够大
    }
  }
}

export const scenarioGenerator = new ScenarioGenerator()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow-jobs",
  "mode": "SHADOW"
};

