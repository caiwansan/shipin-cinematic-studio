// ============================================================
// Knowledge Quality Service — 知识内容质量检测
//
// 不再只看数量，要检测内容质量：
//   - 内容长度（<50字扣分，AI不引用短文）
//   - 具体性（含数字/数据/事实加分）
//   - 去重率（语义重复扣分）
//   - 可追溯性（含来源URL加分）
// ============================================================

import { knowledgeObjectRepository } from '../repositories/knowledge-object.repository.js'

// ── Types ──

export interface KnowledgeQualityReport {
  projectId: string
  overallScore: number
  totalKnowledge: number
  qualifiedKnowledge: number
  issues: QualityIssue[]
  details: QualityDimension[]
}

export interface QualityIssue {
  type: 'too_short' | 'no_specifics' | 'duplicate' | 'no_source' | 'low_confidence'
  severity: 'warning' | 'error'
  message: string
  knowledgeId?: string
  topic?: string
}

export interface QualityDimension {
  name: string
  label: string
  score: number
  maxScore: number
  status: 'good' | 'neutral' | 'bad'
  description: string
}

// ── Constants ──

const MIN_CONTENT_LENGTH = 50      // 最低内容长度
const GOOD_CONTENT_LENGTH = 100    // 良好内容长度
const GOOD_SPECIFICITY_RATIO = 0.3 // 良好具体性比例

// ── Helpers ──

function getKnowledgeContent(ko: any): string {
  const meta = ko.metadata || {}
  return meta.content || meta.text || meta.body || ''
}

function hasSpecifics(content: string): boolean {
  // 含数字、百分比、金额、日期、排名等具体信息
  const patterns = [
    /\d+\.?\d*%/,          // 百分比
    /\d+[\d,]+\.?\d*/,     // 大数字
    /第[一二三四五六七八九十\d]+/, // 排名
    /\d{4}年/,             // 年份
    /[\d.]+元/,            // 金额
    /[\d.]+分/,            // 评分
    /\d+万/,               // 万级
    /\d+亿/,               // 亿级
  ]
  return patterns.some(p => p.test(content))
}

function hasSource(content: string, ko: any): boolean {
  const meta = ko.metadata || {}
  const urlPattern = /https?:\/\/|www\./
  return urlPattern.test(content) || !!meta.source || !!meta.url || !!meta.citation
}

/**
 * 计算两个文本的相似度（基于共同子串）
 */
function computeSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  
  // Use character-level Jaccard similarity for Chinese text
  const setA = new Set<string>()
  const setB = new Set<string>()
  
  // 2-gram
  for (let i = 0; i < a.length - 1; i++) {
    setA.add(a.slice(i, i + 2))
  }
  for (let i = 0; i < b.length - 1; i++) {
    setB.add(b.slice(i, i + 2))
  }
  
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  
  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

// ── Main: Analyze Knowledge Quality ──

export async function analyzeKnowledgeQuality(projectId: string): Promise<KnowledgeQualityReport> {
  const knowledgeObjects = await knowledgeObjectRepository.findMany({ projectId })
  
  if (knowledgeObjects.length === 0) {
    return {
      projectId,
      overallScore: 0,
      totalKnowledge: 0,
      qualifiedKnowledge: 0,
      issues: [{
        type: 'too_short',
        severity: 'error',
        message: '暂无知识条目，请先添加品牌知识内容',
      }],
      details: [
        { name: 'count', label: '知识数量', score: 0, maxScore: 20, status: 'bad', description: '暂无知识条目' },
        { name: 'length', label: '内容长度', score: 0, maxScore: 25, status: 'bad', description: '暂无内容' },
        { name: 'specificity', label: '具体性', score: 0, maxScore: 25, status: 'bad', description: '暂无内容' },
        { name: 'dedup', label: '去重率', score: 0, maxScore: 15, status: 'bad', description: '暂无内容' },
        { name: 'traceability', label: '可追溯', score: 0, maxScore: 15, status: 'bad', description: '暂无内容' },
      ],
    }
  }

  const issues: QualityIssue[] = []
  const contents = knowledgeObjects.map(ko => ({
    ko,
    content: getKnowledgeContent(ko),
  }))

  // ── Dimension 1: Count (max 20) ──
  const count = knowledgeObjects.length
  const countScore = Math.min(20, count * 4)
  const countStatus: 'good' | 'neutral' | 'bad' = count >= 5 ? 'good' : count >= 2 ? 'neutral' : 'bad'

  // ── Dimension 2: Length (max 25) ──
  let totalLength = 0
  let shortCount = 0
  
  for (const { content, ko } of contents) {
    totalLength += content.length
    if (content.length < MIN_CONTENT_LENGTH) {
      shortCount++
      issues.push({
        type: 'too_short',
        severity: 'warning',
        message: `知识「${ko.topic || '未命名'}」内容过短（${content.length}字），AI 引擎难以引用`,
        knowledgeId: ko.id,
        topic: ko.topic || undefined,
      })
    }
  }
  
  const avgLength = totalLength / contents.length
  let lengthScore = 0
  let lengthStatus: 'good' | 'neutral' | 'bad' = 'bad'
  if (avgLength >= GOOD_CONTENT_LENGTH) { lengthScore = 25; lengthStatus = 'good' }
  else if (avgLength >= MIN_CONTENT_LENGTH) { lengthScore = 15; lengthStatus = 'neutral' }
  else { lengthScore = 5; lengthStatus = 'bad' }

  // ── Dimension 3: Specificity (max 25) ──
  let specificCount = 0
  for (const { content, ko } of contents) {
    if (hasSpecifics(content)) {
      specificCount++
    } else if (content.length > 0) {
      issues.push({
        type: 'no_specifics',
        severity: 'warning',
        message: `知识「${ko.topic || '未命名'}」缺少具体数据或事实，建议添加数字、百分比、排名等`,
        knowledgeId: ko.id,
        topic: ko.topic || undefined,
      })
    }
  }
  
  const specificityRatio = specificCount / contents.length
  const specificityScore = Math.min(25, Math.round(specificityRatio * 50))
  const specificityStatus: 'good' | 'neutral' | 'bad' = specificityRatio >= 0.5 ? 'good' : specificityRatio >= 0.2 ? 'neutral' : 'bad'

  // ── Dimension 4: Dedup (max 15) ──
  const duplicatePairs: Array<[string, string]> = []
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const sim = computeSimilarity(contents[i].content, contents[j].content)
      if (sim > 0.6) {
        duplicatePairs.push([
          contents[i].ko.topic || contents[i].ko.id,
          contents[j].ko.topic || contents[j].ko.id,
        ])
        issues.push({
          type: 'duplicate',
          severity: 'warning',
          message: `知识「${contents[i].ko.topic || '未命名'}」与「${contents[j].ko.topic || '未命名'}」内容高度重复（${Math.round(sim * 100)}%）`,
          knowledgeId: contents[j].ko.id,
          topic: contents[j].ko.topic || undefined,
        })
      }
    }
  }
  
  const dedupRatio = contents.length > 0 
    ? 1 - (duplicatePairs.length * 2 / contents.length) 
    : 1
  const dedupScore = Math.max(0, Math.min(15, Math.round(dedupRatio * 15)))
  const dedupStatus: 'good' | 'neutral' | 'bad' = dedupRatio >= 0.8 ? 'good' : dedupRatio >= 0.5 ? 'neutral' : 'bad'

  // ── Dimension 5: Traceability (max 15) ──
  let traceableCount = 0
  for (const { content, ko } of contents) {
    if (hasSource(content, ko)) {
      traceableCount++
    } else if (content.length > 0) {
      issues.push({
        type: 'no_source',
        severity: 'warning',
        message: `知识「${ko.topic || '未命名'}」缺少来源引用，建议添加官网链接或出处`,
        knowledgeId: ko.id,
        topic: ko.topic || undefined,
      })
    }
  }
  
  const traceabilityRatio = traceableCount / contents.length
  const traceabilityScore = Math.min(15, Math.round(traceabilityRatio * 30))
  const traceabilityStatus: 'good' | 'neutral' | 'bad' = traceabilityRatio >= 0.5 ? 'good' : traceabilityRatio >= 0.2 ? 'neutral' : 'bad'

  // ── Overall ──
  const overallScore = countScore + lengthScore + specificityScore + dedupScore + traceabilityScore
  
  // 合格知识 = 长度达标 + 含具体信息
  const qualifiedKnowledge = contents.filter(({ content }) => 
    content.length >= MIN_CONTENT_LENGTH && hasSpecifics(content)
  ).length

  return {
    projectId,
    overallScore: Math.min(100, overallScore),
    totalKnowledge: count,
    qualifiedKnowledge,
    issues: issues.slice(0, 20), // 最多返回 20 个问题
    details: [
      { name: 'count', label: '知识数量', score: countScore, maxScore: 20, status: countStatus, description: `${count} 条知识` },
      { name: 'length', label: '内容长度', score: lengthScore, maxScore: 25, status: lengthStatus, description: `平均 ${Math.round(avgLength)} 字` },
      { name: 'specificity', label: '具体性', score: specificityScore, maxScore: 25, status: specificityStatus, description: `${Math.round(specificityRatio * 100)}% 含具体数据` },
      { name: 'dedup', label: '去重率', score: dedupScore, maxScore: 15, status: dedupStatus, description: `${duplicatePairs.length} 对重复` },
      { name: 'traceability', label: '可追溯', score: traceabilityScore, maxScore: 15, status: traceabilityStatus, description: `${Math.round(traceabilityRatio * 100)}% 含来源` },
    ],
  }
}

/**
 * 快速获取知识质量分（用于评分引擎集成）
 */
export async function getKnowledgeQualityScore(projectId: string): Promise<number> {
  const report = await analyzeKnowledgeQuality(projectId)
  return report.overallScore
}
