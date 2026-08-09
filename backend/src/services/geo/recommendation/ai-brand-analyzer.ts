// ============================================================
// AI Brand Analyzer — LLM-Powered Brand Score Enhancement
// Provides AI-generated insights, suggestions, and score adjustments
// Gracefully falls back to heuristic analysis when LLM is unavailable
// ============================================================

import { genericLLM } from '../../deepseek-llm.provider.js'

// ── Types ──

export interface AIBrandAnalysis {
  available: boolean          // Whether LLM was used
  summary: string             // Overall brand health summary
  suggestions: string[]       // Top 3-5 actionable improvements
  dimensionInsights: {
    visibility: string        // AI insight per dimension
    authority: string
    content: string
    website: string
    knowledge: string
  }
  adjustedScores?: {          // AI-adjusted scores (only when LLM available)
    overall: number
    visibility: number
    authority: number
    content: number
    website: number
    knowledge: number
  }
  provider?: string           // Which LLM provider was used
  latencyMs?: number
}

interface BrandData {
  brandName: string
  website: string
  industry: string
  description: string
  brandProfiles: number
  knowledgeCount: number
  entityCount: number
  claimCount: number
  evidenceCount: number
  relationCount: number
  lastScanStatus: string
  hasWebsite: boolean
  currentScores: {
    overall: number
    visibility: number
    authority: number
    content: number
    website: number
    knowledge: number
  }
}

// ── Helpers ──

function isLLMAvailable(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.LONGCAT_API_KEY)
}

// ── Fallback: Heuristic Analysis (no LLM) ──

function heuristicAnalysis(data: BrandData): AIBrandAnalysis {
  const suggestions: string[] = []
  const insights: AIBrandAnalysis['dimensionInsights'] = {
    visibility: '',
    authority: '',
    content: '',
    website: '',
    knowledge: '',
  }

  // Visibility insight
  if (!data.hasWebsite) {
    suggestions.push('添加官网链接，让 AI 引擎能够发现您的品牌')
    insights.visibility = '未配置官网链接，品牌在 AI 引擎中的可见性受限'
  } else if (data.lastScanStatus !== 'completed') {
    suggestions.push('完成官网扫描，提取品牌核心信息')
    insights.visibility = '官网已配置但扫描未完成，建议尽快完成扫描'
  } else if (data.entityCount < 5) {
    suggestions.push(`建立更多品牌实体（当前 ${data.entityCount} 个，建议 5 个以上）`)
    insights.visibility = '基础可见性已建立，但实体覆盖不足'
  } else {
    insights.visibility = '品牌可见性基础良好，建议持续扩展实体覆盖'
  }

  // Authority insight
  if (data.claimCount === 0) {
    suggestions.push('为品牌实体添加事实声明，提升 AI 引用可信度')
    insights.authority = '缺乏事实声明，AI 引擎难以引用您的品牌信息'
  } else if (data.evidenceCount < data.claimCount * 2) {
    suggestions.push(`为事实声明添加引用证据（当前 ${data.evidenceCount} 条，建议 ${data.claimCount * 2} 条以上）`)
    insights.authority = '有一定事实声明但引用证据不足'
  } else {
    insights.authority = '品牌权威性基础良好，声明有证据支撑'
  }

  // Content insight
  if (data.brandProfiles === 0) {
    suggestions.push('创建品牌资料，完善品牌基本信息')
    insights.content = '尚未创建品牌资料，内容基础薄弱'
  } else if (!data.description) {
    suggestions.push('补充品牌描述，帮助 AI 理解您的品牌价值')
    insights.content = '品牌资料已创建但描述不完整'
  } else if (data.brandProfiles < 2) {
    suggestions.push('补充第二份品牌资料，丰富品牌信息维度')
    insights.content = '品牌内容基础尚可，建议补充更多维度'
  } else {
    insights.content = '品牌内容较为完整，建议定期更新保持新鲜度'
  }

  // Website insight
  if (!data.hasWebsite) {
    insights.website = '未配置官网链接'
  } else if (data.lastScanStatus !== 'completed') {
    insights.website = '官网扫描未完成，无法评估网站健康度'
  } else {
    insights.website = '官网已扫描，建议定期更新内容保持活跃度'
  }

  // Knowledge insight
  if (data.knowledgeCount === 0) {
    suggestions.push('添加知识条目，覆盖品牌核心话题')
    insights.knowledge = '暂无知识条目，品牌知识库为空'
  } else if (data.knowledgeCount < 6) {
    suggestions.push(`扩展知识条目（当前 ${data.knowledgeCount} 条，建议 6 条以上）`)
    insights.knowledge = '知识库基础已建立，建议扩展覆盖更多话题'
  } else {
    insights.knowledge = '知识库内容较为丰富'
  }

  // Generate summary
  const score = data.currentScores.overall
  let summary: string
  if (score >= 70) {
    summary = `品牌 AI 健康度良好（${score}分），基础信息完整，建议持续优化内容质量和知识覆盖`
  } else if (score >= 40) {
    summary = `品牌 AI 健康度一般（${score}分），基础框架已搭建，但需要补充内容细节和证据支撑`
  } else {
    summary = `品牌 AI 健康度较低（${score}分），建议优先完善品牌资料、官网信息和知识条目`
  }

  return {
    available: false,
    summary,
    suggestions: suggestions.slice(0, 5),
    dimensionInsights: insights,
  }
}

// ── AI Analysis (with LLM) ──

async function aiAnalysis(data: BrandData): Promise<AIBrandAnalysis> {
  const startTime = Date.now()

  const systemPrompt = `你是一个专业的 AI 品牌分析引擎。根据提供的品牌数据，给出：
1. 品牌健康度总结（2-3句话）
2. 按优先级排列的改进建议（3-5条，具体可执行）
3. 每个评分维度的简要洞察（每项1句话）
4. 可选的分数微调（如果认为计数评分不够准确）

请以 JSON 格式返回：
{
  "summary": "总结",
  "suggestions": ["建议1", "建议2", ...],
  "dimensionInsights": {
    "visibility": "洞察",
    "authority": "洞察",
    "content": "洞察",
    "website": "洞察",
    "knowledge": "洞察"
  },
  "adjustedScores": {
    "overall": 0-100,
    "visibility": 0-100,
    "authority": 0-100,
    "content": 0-100,
    "website": 0-100,
    "knowledge": 0-100
  }
}

adjustedScores 仅在您认为计数评分有明显偏差时提供，否则省略。`

  const userPrompt = `品牌数据：
- 品牌名称：${data.brandName || '未设置'}
- 官网：${data.website || '未配置'}
- 行业：${data.industry || '未设置'}
- 描述：${data.description || '未填写'}
- 品牌资料：${data.brandProfiles} 份
- 知识条目：${data.knowledgeCount} 条
- 品牌实体：${data.entityCount} 个
- 事实声明：${data.claimCount} 条
- 引用证据：${data.evidenceCount} 条
- 实体关系：${data.relationCount} 条
- 最近扫描状态：${data.lastScanStatus || '未扫描'}

当前计数评分：
- 综合：${data.currentScores.overall}
- 可见性：${data.currentScores.visibility}
- 权威性：${data.currentScores.authority}
- 内容质量：${data.currentScores.content}
- 网站健康：${data.currentScores.website}
- 知识覆盖：${data.currentScores.knowledge}`

  const provider = 'longcat'
  const apiKey = process.env.LONGCAT_API_KEY

  try {
    const resp = await genericLLM.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      provider,
      apiKey,
      model: process.env.LLM_MODEL || undefined,
    })

    const text = resp.text || ''
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('LLM 返回格式无法解析')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      available: true,
      summary: parsed.summary || 'AI 分析完成',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
      dimensionInsights: {
        visibility: parsed.dimensionInsights?.visibility || '',
        authority: parsed.dimensionInsights?.authority || '',
        content: parsed.dimensionInsights?.content || '',
        website: parsed.dimensionInsights?.website || '',
        knowledge: parsed.dimensionInsights?.knowledge || '',
      },
      adjustedScores: parsed.adjustedScores,
      provider,
      latencyMs: Date.now() - startTime,
    }
  } catch (err: any) {
    // LLM failed — fall back to heuristic
    const fallback = heuristicAnalysis(data)
    return {
      ...fallback,
      summary: `[LLM 降级] ${fallback.summary}`,
    }
  }
}

// ── Public API ──

/**
 * Analyze brand with AI enhancement.
 * Automatically uses LLM if available, otherwise falls back to heuristic analysis.
 */
export async function analyzeBrand(
  data: BrandData
): Promise<AIBrandAnalysis> {
  if (isLLMAvailable()) {
    return aiAnalysis(data)
  }
  return heuristicAnalysis(data)
}

/**
 * Check if AI analysis is available
 */
export function isAIAnalysisAvailable(): boolean {
  return isLLMAvailable()
}
