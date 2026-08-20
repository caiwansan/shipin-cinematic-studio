// ============================================================
// Competitor Benchmark Service — 竞品对标引擎
//
// 核心功能：
//   1. 检测品牌在 AI 引擎中的 Share of Voice（SOV）
//   2. 对比品牌与竞品在 AI 回答中的出现频次
//   3. 生成竞品对标报告
// ============================================================

import { genericLLM } from '../../deepseek-llm.provider.js'
import { geoBrandSettingRepository } from '../repositories/geo-brand-setting.repository.js'

// ── Types ──

export interface CompetitorBenchmarkResult {
  /** 品牌名称 */
  brandName: string
  /** 竞品列表 */
  competitors: CompetitorResult[]
  /** 行业 AI 份额（品牌 vs 竞品） */
  shareOfVoice: ShareOfVoiceEntry[]
  /** 品牌优势 */
  strengths: string[]
  /** 品牌劣势 */
  weaknesses: string[]
  /** 竞品提及但品牌未覆盖的话题 */
  uncoveredTopics: string[]
  /** 探测时间 */
  benchmarkedAt: string
}

export interface CompetitorResult {
  name: string
  /** AI 引擎中提及次数 */
  mentionCount: number
  /** AI 对竞品的描述（摘要） */
  aiDescription: string
  /** 竞品在哪些话题上出现 */
  topics: string[]
}

export interface ShareOfVoiceEntry {
  topic: string
  /** 品牌在该话题上的提及次数 */
  brandMentions: number
  /** 竞品在该话题上的提及次数 */
  competitorMentions: Record<string, number>
}

// ── Constants ──

const COMPETITOR_QUESTION_TEMPLATES = [
  '{industry} 行业有哪些主要品牌？',
  '{industry} 行业里最推荐的品牌是哪些？',
  '{industry} 领域的主要玩家有哪些？',
  '请列出 {industry} 行业的头部品牌',
]

// ── Helpers ──

function isLLMAvailable(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.LONGCAT_API_KEY)
}

/** 用 LLM 从行业信息中提取竞品列表 */
async function discoverCompetitors(
  brandName: string,
  industry: string
): Promise<string[]> {
  if (!isLLMAvailable() || !industry) {
    return []
  }

  const provider = process.env.LONGCAT_API_KEY ? 'longcat' : process.env.SILICONFLOW_API_KEY ? 'siliconflow' : 'deepseek'
  const apiKey = process.env.LONGCAT_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.DEEPSEEK_API_KEY

  try {
    const resp = await Promise.race([
      genericLLM.chat({
        messages: [
          {
            role: 'system',
            content: `你是一个行业分析专家。根据提供的行业信息，列出 3-5 个主要竞品品牌。
注意：不要包含用户自己的品牌。
返回 JSON 格式：{ "competitors": ["品牌1", "品牌2", ...] }
只返回 JSON。`,
          },
          {
            role: 'user',
            content: `行业：${industry}
品牌：${brandName}（这是用户自己的品牌，不要包含在竞品中）

请列出该行业 3-5 个主要竞品品牌。`,
          },
        ],
        provider,
        apiKey,
        model: provider === 'longcat' ? 'LongCat-2.0' : undefined,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT')), 15000)
      ),
    ])

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.competitors)) {
        return parsed.competitors
          .filter((c: string) => c.toLowerCase() !== brandName.toLowerCase())
          .slice(0, 5)
      }
    }
  } catch {
    // LLM failed — return empty
  }

  return []
}

/** 检测回答中是否提及某个品牌 */
function countMentions(answer: string, brandName: string): number {
  if (!answer || !brandName) return 0
  const regex = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const matches = answer.match(regex)
  return matches ? matches.length : 0
}

/** 从 AI 回答中提取描述 */
function extractDescription(answer: string, brandName: string): string {
  if (!answer) return ''
  // 找到提及品牌的句子
  const sentences = answer.split(/[。！？\n]/)
  const relevant = sentences.filter(s => s.toLowerCase().includes(brandName.toLowerCase()))
  return relevant.join('。').slice(0, 200) || answer.slice(0, 200)
}

// ── Main: Run Competitor Benchmark ──

/**
 * 执行竞品对标分析
 * 
 * @param projectId 项目 ID
 * @param options 配置选项
 * @returns CompetitorBenchmarkResult
 */
export async function runCompetitorBenchmark(
  projectId: string,
  options: {
    /** 自定义竞品列表（不提供则自动发现） */
    customCompetitors?: string[]
    /** 行业关键词 */
    industryOverride?: string
  } = {}
): Promise<CompetitorBenchmarkResult> {
  const brandSetting = await geoBrandSettingRepository.findFirst({ where: { projectId } })
  const brandName = brandSetting?.brandName || ''
  const industry = options.industryOverride || brandSetting?.industry || ''

  if (!brandName) {
    return {
      brandName: '',
      competitors: [],
      shareOfVoice: [],
      strengths: [],
      weaknesses: [],
      uncoveredTopics: [],
      benchmarkedAt: new Date().toISOString(),
    }
  }

  // 1. 获取竞品列表
  const competitorNames = options.customCompetitors || await discoverCompetitors(brandName, industry)

  if (competitorNames.length === 0) {
    return {
      brandName,
      competitors: [],
      shareOfVoice: [],
      strengths: [],
      weaknesses: [],
      uncoveredTopics: [],
      benchmarkedAt: new Date().toISOString(),
    }
  }

  // 2. 用 LLM 进行多轮探测
  const allBrands = [brandName, ...competitorNames]
  const mentionCounts: Record<string, number> = {}
  const brandDescriptions: Record<string, string> = {}
  const brandTopics: Record<string, Set<string>> = {}

  // 初始化
  for (const b of allBrands) {
    mentionCounts[b] = 0
    brandDescriptions[b] = ''
    brandTopics[b] = new Set<string>()
  }

  if (isLLMAvailable()) {
    const provider = process.env.LONGCAT_API_KEY ? 'longcat' : process.env.SILICONFLOW_API_KEY ? 'siliconflow' : 'deepseek'
    const apiKey = process.env.LONGCAT_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.DEEPSEEK_API_KEY

    // 探测问题
    const questions = industry
      ? COMPETITOR_QUESTION_TEMPLATES.map(q => q.replace(/{industry}/g, industry))
      : [
          `${brandName} 和 ${competitorNames.join('、')} 之间怎么选？`,
          `对比一下 ${allBrands.join('、')} 的优劣势`,
          `${allBrands.join('、')} 各自有什么特点？`,
        ]

    for (const question of questions.slice(0, 3)) {
      try {
        const resp = await Promise.race([
          genericLLM.chat({
            messages: [{ role: 'user', content: question }],
            provider,
            apiKey,
            model: provider === 'longcat' ? 'LongCat-2.0' : undefined,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM_TIMEOUT')), 15000)
          ),
        ])

        const answer = resp.text || ''

        // 统计各品牌提及次数
        for (const b of allBrands) {
          const count = countMentions(answer, b)
          mentionCounts[b] = (mentionCounts[b] || 0) + count

          // 提取描述
          if (!brandDescriptions[b]) {
            brandDescriptions[b] = extractDescription(answer, b)
          }
        }
      } catch {
        // skip
      }
    }
  }

  // 3. 构建结果
  const competitors: CompetitorResult[] = competitorNames.map(name => ({
    name,
    mentionCount: mentionCounts[name] || 0,
    aiDescription: brandDescriptions[name] || '',
    topics: Array.from(brandTopics[name] || []),
  }))

  // 4. 计算 SOV（简化版 — 基于提及总数）
  const totalMentions = Object.values(mentionCounts).reduce((s, v) => s + v, 0)
  const shareOfVoice: ShareOfVoiceEntry[] = competitorNames.length > 0 ? [
    {
      topic: industry || '行业整体',
      brandMentions: mentionCounts[brandName] || 0,
      competitorMentions: competitorNames.reduce((acc, name) => {
        acc[name] = mentionCounts[name] || 0
        return acc
      }, {} as Record<string, number>),
    },
  ] : []

  // 5. 生成优劣势分析
  const strengths: string[] = []
  const weaknesses: string[] = []
  const uncoveredTopics: string[] = []

  const brandMentionCount = mentionCounts[brandName] || 0
  const avgCompetitorMentions = competitors.length > 0
    ? competitors.reduce((s, c) => s + c.mentionCount, 0) / competitors.length
    : 0

  if (brandMentionCount > avgCompetitorMentions) {
    strengths.push(`AI 引擎中品牌提及率高于竞品平均水平（${brandMentionCount} vs ${Math.round(avgCompetitorMentions)} 次）`)
  } else if (brandMentionCount < avgCompetitorMentions) {
    weaknesses.push(`AI 引擎中品牌提及率低于竞品平均水平（${brandMentionCount} vs ${Math.round(avgCompetitorMentions)} 次）`)
  }

  if (brandMentionCount === 0) {
    weaknesses.push('AI 引擎回答中未提及品牌，品牌在 AI 知识库中认知度极低')
  }

  // 竞品覆盖但品牌未覆盖的话题
  const competitorTopicsFlat = new Set<string>()
  competitors.forEach(c => c.topics.forEach(t => competitorTopicsFlat.add(t)))
  const brandTopicsArr = Array.from(brandTopics[brandName] || [])
  competitorTopicsFlat.forEach(t => {
    if (!brandTopicsArr.includes(t)) {
      uncoveredTopics.push(t)
    }
  })

  return {
    brandName,
    competitors,
    shareOfVoice,
    strengths,
    weaknesses,
    uncoveredTopics: uncoveredTopics.slice(0, 5),
    benchmarkedAt: new Date().toISOString(),
  }
}

/**
 * 检查竞品对标是否可用
 */
export function isCompetitorBenchmarkAvailable(): boolean {
  return isLLMAvailable()
}
