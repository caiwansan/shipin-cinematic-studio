// GEO MVP scan service — 轻量 AI 扫描核心逻辑
// 直接调用 provider 底层函数，绕过 UnifiedAIGateway 的全套编排

import { prisma } from '../../../utils/index.js'
import { randomUUID } from 'node:crypto'

// ─── Types ───

interface AIBrandResponse {
  recognizes: boolean
  description: string
  accuracy: 'accurate' | 'partial' | 'inaccurate'
  recommendation: 'positive' | 'neutral' | 'negative'
  mentionsKeywords: string[]
  facts: Array<{ statement: string; confidence: 'high' | 'medium' | 'low' }>
  website: string
}

interface ScanResult {
  model: string
  success: boolean
  error?: string
  response?: AIBrandResponse
  parseError?: boolean
  durationMs: number
}

const SUPPORTED_MODELS = [
  { id: 'chatgpt', name: 'ChatGPT', provider: 'openai', model: 'gpt-4o' },
  { id: 'grok', name: 'Grok', provider: 'openai', model: 'grok-2' },
  { id: 'claude', name: 'Claude', provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { id: 'perplexity', name: 'Perplexity', provider: 'openai', model: 'sonar-pro' },
  { id: 'tongyi', name: '通义千问', provider: 'aliyun', model: 'qwen-max' },
]

const SCAN_TIMEOUT_MS = 30_000

function buildPrompt(brandName: string, website: string, keywords: string[]): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `你是一个品牌分析助手。请分析用户提供的品牌信息并严格按 JSON 格式回复。

要求：
1. 只输出 JSON，不包含任何其他文字
2. 如果完全不了解该品牌，recognizes 设为 false，description 写 "我不知道这个品牌"
3. 如果部分了解，recognizes 设为 true，但 accuracy 用 "partial"
4. facts 数组不超过 5 条，每条 confidence 基于你对该信息的确定程度

JSON 格式：
{
  "recognizes": true/false,
  "description": "3-5句话描述这个品牌",
  "accuracy": "accurate|partial|inaccurate",
  "recommendation": "positive|neutral|negative",
  "mentionsKeywords": ["被提及的关键词"],
  "facts": [
    { "statement": "陈述句", "confidence": "high|medium|low" }
  ],
  "website": "品牌官网地址"
}`,
    },
    {
      role: 'user',
      content: `品牌名：${brandName}
${website ? `网站：${website}` : ''}
${keywords.length > 0 ? `相关关键词：${keywords.join('、')}` : ''}

请告诉我你对这个品牌的了解。`,
    },
  ]
}

function parseAIResponse(raw: string): AIBrandResponse | null {
  try {
    // 尝试直接解析
    return JSON.parse(raw)
  } catch {
    // 尝试从 markdown code block 中提取
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch {
        return null
      }
    }
    return null
  }
}

function calculateScores(results: ScanResult[]): {
  visibilityScore: number
  accuracyScore: number
  consistencyScore: number
  recommendationScore: number
  overallScore: number
} {
  const validResults = results.filter(r => r.success && r.response && !r.parseError)
  if (validResults.length === 0) {
    return { visibilityScore: 0, accuracyScore: 0, consistencyScore: 0, recommendationScore: 0, overallScore: 0 }
  }

  const n = validResults.length

  // ── 可见度：有多少模型能识别品牌 ──
  // 底分 20 分（至少做了扫描就有基础分）
  const rawVisibility = (validResults.filter(r => r.response!.recognizes).length / n) * 100
  const visibilityScore = Math.max(20, Math.round(rawVisibility))

  // ── 准确性：各模型 accuracy 评分的均值 ──
  // accurate=100, partial=50, inaccurate=25（不是0，避免一票否决）
  const accuracySum = validResults.reduce((sum, r) => {
    switch (r.response!.accuracy) {
      case 'accurate': return sum + 100
      case 'partial': return sum + 50
      case 'inaccurate': return sum + 25
      default: return sum + 50
    }
  }, 0)
  const accuracyScore = Math.round(accuracySum / n)

  // ── 一致性：加权文本相似度 + 识别状态一致性 ──
  // 如果 AI 们都说"不知道"，文本差异大但逻辑一致 → 不应给 0 分
  // 新公式：40% 基于识别状态一致性 + 60% 基于文本关键词重叠
  const recognizesCount = validResults.filter(r => r.response!.recognizes).length
  const allNotRecognize = recognizesCount === 0
  const allRecognize = recognizesCount === n

  // 识别状态一致性得分
  const stateConsistency = allNotRecognize || allRecognize ? 100 : 50

  // 文本关键词重叠得分
  const allWords = validResults.map(r => {
    const desc = (r.response && r.response.description) || ''
    return new Set(
      desc
        .replace(/[，。！？、；：""''（）【】]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1)
    )
  })

  let textSimilarity = 30 // 默认底分 30
  if (allWords.length >= 2) {
    // 交集大小
    const intersection = new Set<string>()
    for (const word of allWords[0]) {
      if (allWords.every(set => set.has(word))) {
        intersection.add(word)
      }
    }
    // 并集大小
    const union = new Set<string>()
    for (const set of allWords) {
      for (const word of set) {
        union.add(word)
      }
    }
    const overlapRatio = union.size > 0 ? intersection.size / union.size : 0
    textSimilarity = Math.round(overlapRatio * 100)
    textSimilarity = Math.min(textSimilarity, 100)

    // 当所有模型都说"不知道"时，关键词很少，overlap 也不高
    // 这时文本相似度给底分 30，不应太低
    if (allNotRecognize) {
      textSimilarity = Math.max(textSimilarity, 30)
      // 所有模型都说"不知道"时，高文本相似度是因为模板化回答，不应用满分
      // 限制上限以避免假阳性
      textSimilarity = Math.min(textSimilarity, 60)
    }
  } else {
    textSimilarity = 100 // 只有一个模型时文本满分
  }

  // 综合：状态一致性占 40%，文本相似度占 60%
  // 加 20 分底分
  const consistencyScore = Math.max(20, Math.round(stateConsistency * 0.4 + textSimilarity * 0.6))

  // ── 推荐意愿：positive → 100, neutral → 50, negative → 30 ──
  const recSum = validResults.reduce((sum, r) => {
    switch (r.response!.recommendation) {
      case 'positive': return sum + 100
      case 'neutral': return sum + 50
      case 'negative': return sum + 30  // 30 不是 0，负面推荐也有信息价值
      default: return sum + 50
    }
  }, 0)
  const recommendationScore = Math.round(recSum / n)

  // ── 综合分数 ──
  const overallScore = Math.round(
    visibilityScore * 0.35 +
    accuracyScore * 0.25 +
    consistencyScore * 0.20 +
    recommendationScore * 0.20
  )

  return { visibilityScore, accuracyScore, consistencyScore, recommendationScore, overallScore }
}

function generateOptimizationItems(results: ScanResult[], overall: { visibilityScore: number; accuracyScore: number; consistencyScore: number; recommendationScore: number }): Array<{ dimension: string; description: string; suggestion: string }> {
  const items: Array<{ dimension: string; description: string; suggestion: string }> = []

  // 可见度低
  if (overall.visibilityScore < 70) {
    const unrecognized = results
      .filter(r => r.success && r.response && !r.response.recognizes)
      .map(r => r.model)
    items.push({
      dimension: 'visibility',
      description: unrecognized.length > 0
        ? `${unrecognized.join('、')} 无法识别该品牌`
        : '多个 AI 模型对品牌的认知度偏低',
      suggestion: '在品牌官网添加完整的品牌介绍（About 页面）和企业结构化数据（JSON-LD Organization Schema），确保官网在各搜索引擎有良好收录',
    })
  }

  // 准确性低
  if (overall.accuracyScore < 70) {
    const inaccurateModels = results
      .filter(r => r.success && r.response && (r.response.accuracy === 'inaccurate' || r.response.accuracy === 'partial'))
      .map(r => r.model)
    items.push({
      dimension: 'accuracy',
      description: inaccurateModels.length > 0
        ? `${inaccurateModels.join('、')} 对品牌的描述存在偏差`
        : '部分 AI 模型的品牌描述不够准确，可能存在过时或不完整的信息',
      suggestion: '在官网添加 FAQ 结构化数据，使用 AboutPage Schema 明确品牌定位。建议在多个权威平台（维基百科、行业目录）建立品牌条目',
    })
  }

  // 一致性低
  if (overall.consistencyScore < 70) {
    items.push({
      dimension: 'consistency',
      description: '不同 AI 模型对品牌的描述差异较大，说明品牌信息在各渠道呈现不够统一',
      suggestion: '统一品牌在各平台（官网、社交媒体、百科、行业目录）的品牌描述和定位信息。编写一份标准品牌简介文档便于 AI 抓取',
    })
  }

  // 推荐意愿低
  if (overall.recommendationScore < 70) {
    items.push({
      dimension: 'recommendation',
      description: 'AI 模型对品牌的推荐态度偏中低，可能因为品牌信息不够正面或缺乏公信力',
      suggestion: '增加权威媒体报道和用户评价，在官方渠道展示产品认证和行业奖项信息',
    })
  }

  return items
}

async function callModel(
  model: { id: string; name: string; provider: string; model: string },
  userId: string,
  brandName: string,
  website: string,
  keywords: string[],
  apiKeyFn: (provider: string) => Promise<{ key: string | null; actualProvider: string }>
): Promise<ScanResult> {
  const startTime = Date.now()
  const messages = buildPrompt(brandName, website, keywords)

  try {
    // 获取用户的 API Key，同时得到实际可用的 provider
    const { key: apiKey, actualProvider } = await apiKeyFn(model.provider)
    if (!apiKey) {
      return {
        model: model.id,
        success: false,
        error: `未配置 ${model.name} 的 API Key`,
        durationMs: 0,
      }
    }

    // 如果 actualProvider 和 model.provider 不同（系统 fallback），切换模型名
    // 例如：deepseek 的 key 只能用 deepseek-v4-flash
    let actualModel = model.model
    if (actualProvider === 'deepseek' && model.provider !== 'deepseek') {
      actualModel = 'deepseek-v4-flash'
    }

    // 统一走 genericLLM.chat()，用 actualProvider 确保 key 与 provider 匹配
    const { genericLLM } = await import('../../deepseek-llm.provider.js')
    const resp = await raceTimeout(
      genericLLM.chat({
        messages,
        model: actualModel,
        apiKey,
        provider: actualProvider,
      }),
      SCAN_TIMEOUT_MS
    )
    const rawResponse = resp?.text || ''

    const parsed = parseAIResponse(rawResponse)
    if (!parsed) {
      return {
        model: model.id,
        success: false,
        error: 'AI 返回的 JSON 解析失败',
        parseError: true,
        durationMs: Date.now() - startTime,
      }
    }

    return {
      model: model.id,
      success: true,
      response: parsed,
      durationMs: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      model: model.id,
      success: false,
      error: err.message || 'Unknown error',
      durationMs: Date.now() - startTime,
    }
  }
}

function getBaseUrl(modelId: string, provider: string): string {
  const urls: Record<string, string> = {
    chatgpt: 'https://api.openai.com/v1',
    grok: 'https://api.x.ai/v1',
    claude: 'https://api.anthropic.com/v1',
    perplexity: 'https://api.perplexity.ai',
  }
  return urls[modelId] || 'https://api.openai.com/v1'
}

async function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ])
}

// ─── Main Scan Entry ───

export async function scanBrand(
  projectId: string,
  userId: string,
  targetModels?: string[]  // 可选：只扫描指定模型，默认全部
): Promise<{ scanId: string }> {
  // 1. 获取品牌信息
  const project = await prisma.gEOProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error(`Project not found: ${projectId}`)

  let keywords: string[] = []
  if (project.keywords && typeof project.keywords === 'object') {
    const kws = project.keywords as any
    keywords = Array.isArray(kws) ? kws : []
  }

  // 2. 创建扫描记录
  const scanId = randomUUID()
  await prisma.gEOScanRecord.create({
    data: {
      id: scanId,
      projectId,
      userId,
      scanStatus: 'running',
      scanStartedAt: new Date(),
    },
  })

  // 3. 异步执行扫描（不 await）
  executeScan(scanId, projectId, project.name, project.website || '', keywords, userId, targetModels).catch(err => {
    console.error(`[GEOScan] Scan ${scanId} failed:`, err)
    prisma.gEOScanRecord.update({
      where: { id: scanId },
      data: { scanStatus: 'failed', errorMessage: err.message, scanFinishedAt: new Date() },
    }).catch(e => console.error('[GEOScan] Failed to update error status:', e))
  })

  return { scanId }
}

async function executeScan(
  scanId: string,
  projectId: string,
  brandName: string,
  website: string,
  keywords: string[],
  userId: string,
  targetModels?: string[]
): Promise<void> {
  const modelsToScan = targetModels
    ? SUPPORTED_MODELS.filter(m => targetModels.includes(m.id))
    : SUPPORTED_MODELS

  // API Key 获取函数 — 优先用系统配置的 key（已验证有效），fallback 到用户自配 key
  const getApiKey = async (provider: string): Promise<{ key: string | null; actualProvider: string }> => {
    try {
      // 1. 优先用系统级 API Key（通过 ApiKey 表配置，维护者已验证可用）
      const systemKey = await prisma.apiKey.findFirst({
        where: { provider, keyName: { not: { contains: 'global' } } },
      })
      if (systemKey?.keyValue) return { key: systemKey.keyValue, actualProvider: provider }

      // 2. 精确 provider 没找到，fallback 到 deepseek 系统 key
      const fallbackSystemKey = await prisma.apiKey.findFirst({
        where: { keyName: { not: { contains: 'global' } } },
        orderBy: { updatedAt: 'desc' },
      })
      if (fallbackSystemKey?.keyValue) return { key: fallbackSystemKey.keyValue, actualProvider: fallbackSystemKey.provider }

      // 3. 最后用用户的 LLM API Key（可能已过期）
      const config = await prisma.userModelConfigV2.findUnique({
        where: { userId },
      })
      if (config?.llmApiKey) return { key: config.llmApiKey, actualProvider: config.llmProvider || provider }

      return { key: null, actualProvider: provider }
    } catch {
      return { key: null, actualProvider: provider }
    }
  }

  // 并行调用所有模型
  const results = await Promise.all(
    modelsToScan.map(model =>
      callModel(model, userId, brandName, website, keywords, getApiKey)
    )
  )

  // 计算分数
  const scores = calculateScores(results)
  const optimizationItems = generateOptimizationItems(results, scores)

  // 更新扫描记录
  const successCount = results.filter(r => r.success && !r.parseError).length
  const completedStatus = successCount > 0 ? 'completed' : 'failed'

  await prisma.gEOScanRecord.update({
    where: { id: scanId },
    data: {
      scanStatus: completedStatus,
      scanFinishedAt: new Date(),
      visibilityScore: scores.visibilityScore,
      accuracyScore: scores.accuracyScore,
      consistencyScore: scores.consistencyScore,
      recommendationScore: scores.recommendationScore,
      overallScore: scores.overallScore,
      aiResponses: results as any,
      optimizationItems: JSON.parse(JSON.stringify(optimizationItems)),
      durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
      errorMessage: completedStatus === 'failed' ? '所有 AI 模型均未能返回有效结果' : undefined,
    },
  })
}

// ─── Query ───

export async function getScanResult(scanId: string) {
  return prisma.gEOScanRecord.findUnique({ where: { id: scanId } })
}

export async function getScanResultsByProject(projectId: string) {
  return prisma.gEOScanRecord.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export async function getLatestScanByProject(projectId: string) {
  return prisma.gEOScanRecord.findFirst({
    where: { projectId, scanStatus: 'completed' },
    orderBy: { createdAt: 'desc' },
  })
}
