// ============================================================
// Diagnosis Engine — 分析 AI 探测失败原因
//
// 核心能力：精确诊断为什么 AI 没有提到品牌
// 1. 知识缺口：品牌知识库没有覆盖该问题主题
// 2. 定位模糊：有内容但不够具体/独特
// 3. 内容质量问题：太短、太泛、重复
// ============================================================

import { prisma } from '../../../utils/index.js'
import { genericLLM } from '../../deepseek-llm.provider.js'
import type { AIProbeResult } from './ai-probe.service.js'

// ── Types ──

export interface DiagnosisReport {
  /** 总体诊断摘要 */
  summary: {
    totalQuestions: number
    mentionCount: number
    missCount: number
    overallMentionRate: number
  }
  /** 每个失败问题的详细诊断 */
  missedQuestions: MissedQuestionDiagnosis[]
  /** 知识缺口列表（需要补充的主题） */
  knowledgeGaps: KnowledgeGap[]
  /** 内容质量问题 */
  contentIssues: ContentIssue[]
  /** 优化建议（按优先级排序） */
  recommendations: DiagnosisRecommendation[]
}

export interface MissedQuestionDiagnosis {
  question: string
  /** 失败原因类型 */
  reason: 'missing_knowledge' | 'weak_positioning' | 'content_too_short' | 'content_too_generic' | 'competitor_dominance' | 'unknown'
  /** 失败原因描述 */
  reasonDetail: string
  /** 对应的知识缺口（如有） */
  relatedGap?: string
  /** 置信度 */
  confidence: number
}

export interface KnowledgeGap {
  /** 缺口主题 */
  topic: string
  /** 缺口描述 */
  description: string
  /** 关联的问题 */
  relatedQuestions: string[]
  /** 优先级 1-10 */
  priority: number
}

export interface ContentIssue {
  /** 问题类型 */
  type: 'too_short' | 'too_generic' | 'duplicate' | 'no_data' | 'no_source'
  /** 问题描述 */
  description: string
  /** 受影响的知识条目ID */
  affectedKnowledgeIds: string[]
  /** 建议修复方式 */
  suggestion: string
}

export interface DiagnosisRecommendation {
  /** 建议动作 */
  action: 'add_knowledge' | 'rewrite_knowledge' | 'enrich_content' | 'add_specific_data'
  /** 目标主题 */
  targetTopic: string
  /** 具体建议 */
  detail: string
  /** 优先级 1-10 */
  priority: number
  /** 关联问题 */
  relatedQuestions: string[]
}

// ── Helpers ──

function isLLMAvailable(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.LONGCAT_API_KEY)
}

async function getBrandContext(projectId: string) {
  const [brandSetting, brandProfile, knowledgeObjects, graphNodes] = await Promise.all([
    prisma.geoBrandSetting.findFirst({ where: { projectId } }).catch(() => null),
    prisma.geoBrandProfile.findFirst({ where: { projectId } }).catch(() => null),
    prisma.knowledgeObject.findMany({ where: { projectId }, take: 50 }).catch(() => []),
    prisma.geoGraphNode.findMany({ where: { projectId }, take: 30 }).catch(() => []),
  ])
  return { brandSetting, brandProfile, knowledgeObjects, graphNodes }
}

// ── Main Diagnosis ──

/**
 * 执行诊断分析
 * 
 * @param projectId 项目 ID
 * @param probeResult AI 探测结果
 * @returns DiagnosisReport
 */
export async function diagnoseVisibility(
  projectId: string,
  probeResult: AIProbeResult
): Promise<DiagnosisReport> {
  const brand = await getBrandContext(projectId)
  const brandName = brand.brandSetting?.brandName || brand.brandProfile?.brandName || ''

  if (!brandName || !probeResult.questionResults.length) {
    return {
      summary: {
        totalQuestions: 0,
        mentionCount: 0,
        missCount: 0,
        overallMentionRate: 0,
      },
      missedQuestions: [],
      knowledgeGaps: [],
      contentIssues: [],
      recommendations: [],
    }
  }

  // 1. 分类：哪些题提到了，哪些没有
  const mentioned = probeResult.questionResults.filter(q => q.anyMention)
  const missed = probeResult.questionResults.filter(q => !q.anyMention)

  // 2. 分析知识库覆盖情况
  const knowledgeTopics = (brand.knowledgeObjects || []).map((ko: any) => {
    const meta = ko.metadata || {}
    return {
      id: ko.id,
      topic: ko.topic || '',
      content: meta.content || meta.text || '',
      qualityScore: ko.qualityScore || 0,
    }
  }).filter((k: any) => k.topic)

  // 3. 对每个失败问题进行诊断
  const missedDiagnoses: MissedQuestionDiagnosis[] = []
  for (const mq of missed) {
    const diagnosis = await diagnoseSingleQuestion(mq.question, brandName, knowledgeTopics, mq.answers)
    missedDiagnoses.push(diagnosis)
  }

  // 4. 汇总知识缺口
  const knowledgeGaps = aggregateKnowledgeGaps(missedDiagnoses, knowledgeTopics, brandName)

  // 5. 检测内容质量问题
  const contentIssues = detectContentIssues(knowledgeTopics)

  // 6. 生成优化建议
  const recommendations = generateRecommendations(missedDiagnoses, knowledgeGaps, contentIssues)

  return {
    summary: {
      totalQuestions: probeResult.questionResults.length,
      mentionCount: mentioned.length,
      missCount: missed.length,
      overallMentionRate: probeResult.questionResults.length > 0
        ? mentioned.length / probeResult.questionResults.length
        : 0,
    },
    missedQuestions: missedDiagnoses,
    knowledgeGaps,
    contentIssues,
    recommendations: recommendations.sort((a, b) => b.priority - a.priority),
  }
}

// ── Per-Question Diagnosis ──

async function diagnoseSingleQuestion(
  question: string,
  brandName: string,
  knowledgeTopics: Array<{ id: string; topic: string; content: string; qualityScore: number }>,
  answers: Record<string, string>
): Promise<MissedQuestionDiagnosis> {
  // 快速启发式判断：知识库是否有相关内容
  const questionKeywords = extractKeywords(question)
  const matchedTopics = knowledgeTopics.filter(kt => {
    const topicKeywords = extractKeywords(kt.topic + ' ' + kt.content)
    return questionKeywords.some(kw => topicKeywords.includes(kw))
  })

  // 如果知识库完全没有相关知识 → 知识缺口
  if (matchedTopics.length === 0) {
    return {
      question,
      reason: 'missing_knowledge',
      reasonDetail: `知识库中没有与「${question}」相关的主题内容`,
      confidence: 0.85,
    }
  }

  // 有相关知识但 AI 没提到 → 分析原因
  const shortContent = matchedTopics.filter(kt => kt.content.length < 30)
  const lowQuality = matchedTopics.filter(kt => kt.qualityScore < 0.5)

  if (shortContent.length === matchedTopics.length) {
    return {
      question,
      reason: 'content_too_short',
      reasonDetail: `有 ${matchedTopics.length} 条相关知识，但内容都太短（<30字），AI 无法有效引用`,
      relatedGap: matchedTopics[0]?.topic,
      confidence: 0.75,
    }
  }

  if (lowQuality.length > 0) {
    return {
      question,
      reason: 'content_too_generic',
      reasonDetail: `有相关内容但质量分过低（${lowQuality.map(k => k.topic).join('、')}），内容可能过于泛化`,
      relatedGap: lowQuality[0]?.topic,
      confidence: 0.7,
    }
  }

  // 有内容且质量还行 → 可能是定位问题
  return {
    question,
    reason: 'weak_positioning',
    reasonDetail: `知识库有相关内容，但 AI 仍选择不引用，可能是品牌差异化不够突出`,
    relatedGap: matchedTopics[0]?.topic,
    confidence: 0.6,
  }
}

// ── Knowledge Gap Aggregation ──

function aggregateKnowledgeGaps(
  diagnoses: MissedQuestionDiagnosis[],
  knowledgeTopics: Array<{ id: string; topic: string; content: string }>,
  brandName: string
): KnowledgeGap[] {
  const gapMap = new Map<string, KnowledgeGap>()

  for (const d of diagnoses) {
    if (d.reason === 'missing_knowledge') {
      // 从问题中提取主题
      const topic = inferTopicFromQuestion(d.question, brandName)
      const existing = gapMap.get(topic)
      if (existing) {
        existing.relatedQuestions.push(d.question)
        existing.priority = Math.min(10, existing.priority + 1)
      } else {
        gapMap.set(topic, {
          topic,
          description: d.reasonDetail,
          relatedQuestions: [d.question],
          priority: Math.round(d.confidence * 8),
        })
      }
    }
  }

  return Array.from(gapMap.values()).sort((a, b) => b.priority - a.priority)
}

// ── Content Issue Detection ──

function detectContentIssues(
  knowledgeTopics: Array<{ id: string; topic: string; content: string; qualityScore: number }>
): ContentIssue[] {
  const issues: ContentIssue[] = []

  // 检测过短内容
  const tooShort = knowledgeTopics.filter(kt => kt.content.length < 30)
  if (tooShort.length > 0) {
    issues.push({
      type: 'too_short',
      description: `${tooShort.length} 条知识内容不足 30 字，AI 引擎难以引用`,
      affectedKnowledgeIds: tooShort.map(kt => kt.id),
      suggestion: '扩充内容至 50-150 字，加入具体数据和品牌差异化描述',
    })
  }

  // 检测缺乏具体数据
  const noDataPattern = /\d+\.?\d*%|\d+万|\d+亿|[\d.]+分|[\d.]+元|第[一二三四五六七八九十\d]+/
  const noData = knowledgeTopics.filter(kt => kt.content.length >= 30 && !noDataPattern.test(kt.content))
  if (noData.length > 0) {
    issues.push({
      type: 'no_data',
      description: `${noData.length} 条知识内容缺少具体数据或量化指标`,
      affectedKnowledgeIds: noData.map(kt => kt.id),
      suggestion: '添加具体数字、排名、百分比等可量化信息，提升 AI 引用概率',
    })
  }

  // 检测重复内容
  const contentSet = new Map<string, string[]>()
  for (const kt of knowledgeTopics) {
    const normalized = kt.content.replace(/\s/g, '').slice(0, 20)
    if (!contentSet.has(normalized)) contentSet.set(normalized, [])
    contentSet.get(normalized)!.push(kt.id)
  }
  const duplicates = Array.from(contentSet.values()).filter(ids => ids.length > 1)
  if (duplicates.length > 0) {
    issues.push({
      type: 'duplicate',
      description: `发现 ${duplicates.length} 组重复或高度相似的知识内容`,
      affectedKnowledgeIds: duplicates.flat(),
      suggestion: '合并重复内容，为每条知识添加独特视角或差异化信息',
    })
  }

  return issues
}

// ── Recommendation Generation ──

function generateRecommendations(
  diagnoses: MissedQuestionDiagnosis[],
  gaps: KnowledgeGap[],
  issues: ContentIssue[]
): DiagnosisRecommendation[] {
  const recs: DiagnosisRecommendation[] = []

  // 知识缺口 → 建议新增知识
  for (const gap of gaps) {
    recs.push({
      action: 'add_knowledge',
      targetTopic: gap.topic,
      detail: `新增「${gap.topic}」相关知识，覆盖 ${gap.relatedQuestions.length} 个未被 AI 引用的问题`,
      priority: gap.priority,
      relatedQuestions: gap.relatedQuestions,
    })
  }

  // 内容质量问题 → 建议改写
  for (const issue of issues) {
    if (issue.type === 'too_short') {
      recs.push({
        action: 'rewrite_knowledge',
        targetTopic: '内容扩充',
        detail: issue.suggestion,
        priority: 7,
        relatedQuestions: [],
      })
    }
    if (issue.type === 'no_data') {
      recs.push({
        action: 'add_specific_data',
        targetTopic: '数据丰富',
        detail: issue.suggestion,
        priority: 6,
        relatedQuestions: [],
      })
    }
  }

  // 定位问题 → 建议差异化
  const weakPositioning = diagnoses.filter(d => d.reason === 'weak_positioning')
  if (weakPositioning.length > 0) {
    recs.push({
      action: 'enrich_content',
      targetTopic: '品牌差异化',
      detail: `强化品牌独特卖点描述，${weakPositioning.length} 个问题因定位模糊未被引用`,
      priority: 8,
      relatedQuestions: weakPositioning.map(d => d.question),
    })
  }

  return recs
}

// ── Utility ──

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: split by common delimiters and filter
  const cleaned = text.replace(/[？?！!。，,、：:；;""''（）()【】\[\]{}]/g, ' ')
  return cleaned.split(/\s+/).filter(w => w.length >= 2)
}

function inferTopicFromQuestion(question: string, brandName: string): string {
  // Extract the core topic from a question
  const q = question.replace(brandName, '').trim()
  if (q.includes('什么') || q.includes('介绍')) return `${brandName} 品牌介绍`
  if (q.includes('怎么样') || q.includes('好不好') || q.includes('如何') || q.includes('推荐')) return `${brandName} 产品评价`
  if (q.includes('核心') || q.includes('服务') || q.includes('产品')) return `${brandName} 核心产品`
  if (q.includes('地位') || q.includes('行业') || q.includes('水平')) return `${brandName} 行业地位`
  return `${brandName} 品牌知识`
}
