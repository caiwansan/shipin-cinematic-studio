// ============================================================
// AI Probe Service — 真实 AI 可见度实测
// 
// 核心思路：不再用「录入数据量」代替「真实 AI 认知」
// 向多个 AI 引擎发送品牌问题，检测品牌是否被提及
//
// 评分公式：AI Visibility = 基础分(30%) + AI 引用率(40%) + 内容质量(30%)
// ============================================================

import { genericLLM } from '../../deepseek-llm.provider.js'
import { geoBrandSettingRepository } from '../repositories/geo-brand-setting.repository.js'
import { knowledgeObjectRepository } from '../repositories/knowledge-object.repository.js'
import { geoEntityRepository } from '../repositories/geo-entity.repository.js'

// ── Types ──

export interface AIProbeResult {
  /** 总体 AI 可见度评分 (0-100) */
  overall: number
  /** 各 AI 引擎的探测结果 */
  engineResults: AIEngineResult[]
  /** 品牌问题集的探测详情 */
  questionResults: QuestionResult[]
  /** 内容质量评分 */
  contentQuality: ContentQualityScore
  /** 探测时间 */
  probedAt: string
}

export interface AIEngineResult {
  engine: string
  label: string
  /** 品牌被提及的问题数 */
  mentionCount: number
  /** 总问题数 */
  totalQuestions: number
  /** 引用率 (0-1) */
  mentionRate: number
  /** AI 对品牌的描述准确度 (0-1) */
  accuracy: number
  /** 延迟 ms */
  latencyMs: number
}

export interface QuestionResult {
  question: string
  /** 各引擎是否提及品牌 */
  mentions: Record<string, boolean>
  /** 各引擎的回答摘要 */
  answers: Record<string, string>
  /** 至少一个引擎提及 */
  anyMention: boolean
}

export interface ContentQualityScore {
  /** 内容质量分 (0-100) */
  score: number
  /** 知识条目数量 */
  knowledgeCount: number
  /** 平均内容长度 */
  avgContentLength: number
  /** 含具体数据/事实的比例 */
  specificityRatio: number
  /** 语义重复比例 */
  duplicationRatio: number
  /** 来源可追溯比例 */
  traceabilityRatio: number
  /** 详细评分项 */
  details: { label: string; score: number; maxScore: number; status: 'good' | 'neutral' | 'bad' }[]
}

// ── Constants ──

/** 默认探测问题模板 */
const DEFAULT_QUESTION_TEMPLATES = [
  '{brandName} 是什么品牌？',
  '{brandName} 怎么样？值得推荐吗？',
  '{brandName} 的核心产品或服务是什么？',
  '请介绍一下 {brandName}',
  '{brandName} 在行业中的地位如何？',
]

/** AI 引擎配置 */
const AI_ENGINES = [
  { id: 'deepseek', label: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  { id: 'longcat', label: 'LongCat', envKey: 'LONGCAT_API_KEY', baseUrl: 'https://api.longcat.chat/openai/v1', model: 'LongCat-2.0' },
  { id: 'siliconflow', label: 'SiliconFlow', envKey: 'SILICONFLOW_API_KEY', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3.2' },
]

// ── Helpers ──

function isEngineAvailable(engine: typeof AI_ENGINES[number]): boolean {
  return !!(process.env[engine.envKey])
}

/** 根据品牌信息生成探测问题 */
function generateProbeQuestions(brandName: string, industry: string): string[] {
  const questions = [...DEFAULT_QUESTION_TEMPLATES]
  
  if (industry) {
    questions.push(`${industry} 行业里 {brandName} 算什么水平？`)
  }
  
  return questions.map(q => q.replace(/{brandName}/g, brandName))
}

/** 检查回答中是否提及品牌 */
function checkBrandMention(answer: string, brandName: string): boolean {
  if (!answer || !brandName) return false
  const lower = answer.toLowerCase()
  const nameLower = brandName.toLowerCase()
  return lower.includes(nameLower)
}

/** 调用单个 AI 引擎 */
async function queryEngine(
  engine: typeof AI_ENGINES[number],
  question: string
): Promise<{ answer: string; latencyMs: number }> {
  const start = Date.now()
  
  try {
    const resp = await Promise.race([
      genericLLM.chat({
        messages: [{ role: 'user', content: question }],
        provider: engine.id,
        apiKey: process.env[engine.envKey] || '',
        baseUrl: engine.baseUrl,
        model: engine.model,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('ENGINE_TIMEOUT')), 15000)
      ),
    ])
    
    return {
      answer: resp.text || '',
      latencyMs: Date.now() - start,
    }
  } catch {
    return { answer: '', latencyMs: Date.now() - start }
  }
}

// ── Content Quality Analysis ──

async function analyzeContentQuality(projectId: string): Promise<ContentQualityScore> {
  const knowledgeObjects = await knowledgeObjectRepository.findMany({ projectId })
  
  if (knowledgeObjects.length === 0) {
    return {
      score: 0,
      knowledgeCount: 0,
      avgContentLength: 0,
      specificityRatio: 0,
      duplicationRatio: 0,
      traceabilityRatio: 0,
      details: [
        { label: '知识条目', score: 0, maxScore: 30, status: 'bad' },
        { label: '内容长度', score: 0, maxScore: 20, status: 'bad' },
        { label: '具体性', score: 0, maxScore: 20, status: 'bad' },
        { label: '去重率', score: 0, maxScore: 15, status: 'bad' },
        { label: '可追溯', score: 0, maxScore: 15, status: 'bad' },
      ],
    }
  }

  // 1. 知识条目数量 (max 30)
  const koCount = knowledgeObjects.length
  const countScore = Math.min(30, koCount * 5)
  const countStatus: 'good' | 'neutral' | 'bad' = koCount >= 6 ? 'good' : koCount >= 3 ? 'neutral' : 'bad'

  // 2. 内容长度分析 (max 20)
  const contents = knowledgeObjects.map((ko: any) => {
    const meta = ko.metadata || {}
    return meta.content || meta.text || ko.topic || ''
  }).filter(Boolean)
  
  const avgLength = contents.length > 0 
    ? contents.reduce((sum: number, c: string) => sum + c.length, 0) / contents.length 
    : 0
  
  let lengthScore = 0
  let lengthStatus: 'good' | 'neutral' | 'bad' = 'bad'
  if (avgLength >= 100) { lengthScore = 20; lengthStatus = 'good' }
  else if (avgLength >= 50) { lengthScore = 12; lengthStatus = 'neutral' }
  else if (avgLength >= 20) { lengthScore = 6; lengthStatus = 'bad' }

  // 3. 具体性 — 含数字/数据/百分比的比例 (max 20)
  const specificPatterns = /\d+\.?\d*%?|\d+万|\d+亿|第[一二三四五六七八九十\d]+|[\d.]+分|[\d.]+元/g
  const specificCount = contents.filter((c: string) => specificPatterns.test(c)).length
  const specificityRatio = contents.length > 0 ? specificCount / contents.length : 0
  const specificityScore = Math.min(20, Math.round(specificityRatio * 40))
  const specificityStatus: 'good' | 'neutral' | 'bad' = specificityRatio >= 0.5 ? 'good' : specificityRatio >= 0.2 ? 'neutral' : 'bad'

  // 4. 语义重复 — 检测重复关键词 (max 15)
  const allKeywords = new Map<string, number>()
  contents.forEach((c: string) => {
    // Simple keyword extraction: 2-char substrings
    for (let i = 0; i < c.length - 1; i++) {
      const kw = c.slice(i, i + 2)
      allKeywords.set(kw, (allKeywords.get(kw) || 0) + 1)
    }
  })
  // High duplication = many keywords appear in >50% of contents
  const highDupKeywords = Array.from(allKeywords.values()).filter((v: number) => v > contents.length * 0.5).length
  const totalKeywords = allKeywords.size || 1
  const duplicationRatio = highDupKeywords / totalKeywords
  const dedupScore = Math.max(0, Math.round(15 - duplicationRatio * 30))
  const dedupStatus: 'good' | 'neutral' | 'bad' = duplicationRatio < 0.2 ? 'good' : duplicationRatio < 0.4 ? 'neutral' : 'bad'

  // 5. 可追溯 — 含来源 URL 或引用 (max 15)
  const urlPattern = /https?:\/\/|来源|引用|出自|摘自/
  const traceableCount = contents.filter((c: string) => urlPattern.test(c)).length
  const traceabilityRatio = contents.length > 0 ? traceableCount / contents.length : 0
  const traceScore = Math.min(15, Math.round(traceabilityRatio * 30))
  const traceStatus: 'good' | 'neutral' | 'bad' = traceabilityRatio >= 0.5 ? 'good' : traceabilityRatio >= 0.2 ? 'neutral' : 'bad'

  const totalScore = countScore + lengthScore + specificityScore + dedupScore + traceScore

  return {
    score: Math.min(100, totalScore),
    knowledgeCount: koCount,
    avgContentLength: Math.round(avgLength),
    specificityRatio: Math.round(specificityRatio * 100) / 100,
    duplicationRatio: Math.round(duplicationRatio * 100) / 100,
    traceabilityRatio: Math.round(traceabilityRatio * 100) / 100,
    details: [
      { label: '知识条目', score: countScore, maxScore: 30, status: countStatus },
      { label: '内容长度', score: lengthScore, maxScore: 20, status: lengthStatus },
      { label: '具体性', score: specificityScore, maxScore: 20, status: specificityStatus },
      { label: '去重率', score: dedupScore, maxScore: 15, status: dedupStatus },
      { label: '可追溯', score: traceScore, maxScore: 15, status: traceStatus },
    ],
  }
}

// ── Main: Run AI Probe ──

/**
 * 执行 AI 可见度探测
 * 
 * @param projectId 项目 ID
 * @param options 配置选项
 * @returns AIProbeResult
 */
export async function runAIProbe(
  projectId: string,
  options: {
    /** 自定义问题列表 */
    customQuestions?: string[]
    /** 限制探测的引擎 */
    engineFilter?: string[]
    /** 每个引擎的问题数限制 */
    maxQuestionsPerEngine?: number
  } = {}
): Promise<AIProbeResult> {
  const startTime = Date.now()

  // 1. 获取品牌信息
  const brandSetting = await geoBrandSettingRepository.findFirst({ where: { projectId } })
  const brandName = brandSetting?.brandName || ''
  const industry = brandSetting?.industry || ''

  if (!brandName) {
    return {
      overall: 0,
      engineResults: [],
      questionResults: [],
      contentQuality: await analyzeContentQuality(projectId),
      probedAt: new Date().toISOString(),
    }
  }

  // 2. 生成探测问题
  const questions = options.customQuestions || generateProbeQuestions(brandName, industry)
  const maxQ = options.maxQuestionsPerEngine || questions.length
  const limitedQuestions = questions.slice(0, maxQ)

  // 3. 筛选可用引擎
  const availableEngines = AI_ENGINES.filter(e => 
    isEngineAvailable(e) && (!options.engineFilter || options.engineFilter.includes(e.id))
  )

  if (availableEngines.length === 0) {
    return {
      overall: 0,
      engineResults: [],
      questionResults: [],
      contentQuality: await analyzeContentQuality(projectId),
      probedAt: new Date().toISOString(),
    }
  }

  // 4. 对每个引擎发送所有问题
  const engineResults: AIEngineResult[] = []
  const questionResults: QuestionResult[] = limitedQuestions.map(q => ({
    question: q,
    mentions: {},
    answers: {},
    anyMention: false,
  }))

  for (const engine of availableEngines) {
    let mentionCount = 0
    let totalLatency = 0

    for (let i = 0; i < limitedQuestions.length; i++) {
      const q = limitedQuestions[i]
      const { answer, latencyMs } = await queryEngine(engine, q)
      totalLatency += latencyMs

      const mentioned = checkBrandMention(answer, brandName)
      questionResults[i].mentions[engine.id] = mentioned
      questionResults[i].answers[engine.id] = answer.slice(0, 200) // 截断存储
      if (mentioned) {
        questionResults[i].anyMention = true
        mentionCount++
      }
    }

    engineResults.push({
      engine: engine.id,
      label: engine.label,
      mentionCount,
      totalQuestions: limitedQuestions.length,
      mentionRate: limitedQuestions.length > 0 ? mentionCount / limitedQuestions.length : 0,
      accuracy: 0, // TODO: 用 LLM 评估回答准确度
      latencyMs: Math.round(totalLatency / limitedQuestions.length),
    })
  }

  // 5. 计算内容质量
  const contentQuality = await analyzeContentQuality(projectId)

  // 6. 计算总体 AI 可见度
  // 公式：AI Visibility = 基础分(30%) + AI 引用率(40%) + 内容质量(30%)
  const avgMentionRate = engineResults.length > 0
    ? engineResults.reduce((s, e) => s + e.mentionRate, 0) / engineResults.length
    : 0

  const baseScore = 30 // 基础分（品牌已创建）
  const mentionScore = avgMentionRate * 40 // AI 引用率得分
  const qualityScore = (contentQuality.score / 100) * 30 // 内容质量得分

  const overall = Math.min(100, Math.round(baseScore + mentionScore + qualityScore))

  return {
    overall,
    engineResults,
    questionResults,
    contentQuality,
    probedAt: new Date().toISOString(),
  }
}

/**
 * 检查 AI 探测是否可用（至少一个引擎已配置）
 */
export function isAIProbeAvailable(): boolean {
  return AI_ENGINES.some(e => isEngineAvailable(e))
}
