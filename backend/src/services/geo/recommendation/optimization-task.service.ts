// ============================================================
// Optimization Task Service v2 — Task ROI
// Generates actionable tasks with ROI estimates and prerequisites
// ============================================================

import { calculateScore, ScoreExplainability, ScoreDetailItem } from './recommendation-score.service.js'

export interface TaskWithROI {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  title: string
  description: string
  reason: string           // WHY: explain root cause
  impact: number            // estimated score points gained
  impactPercentile: string  // e.g. "+6~12%"
  effort: 'EASY' | 'MEDIUM' | 'HARD'
  prerequisites: string[]
}

type TaskDef = Omit<TaskWithROI, 'impact' | 'impactPercentile'> & {
  gapCondition: (score: ScoreExplainability) => number  // returns gap: 0 = no gap, >0 = gap
  maxImpact: number
}

// ── ROI helpers ──

/**
 * Calculate ROI-based impact: diminishing returns as score approaches max.
 * If score is 20/100, gap = 80, impact is near maxImpact.
 * If score is 80/100, gap = 20, impact is a fraction of maxImpact.
 */
function calcImpact(currentScore: number, maxScore: number, maxImpact: number): number {
  const gap = Math.max(0, maxScore - currentScore)
  if (gap <= 0) return 0
  // Diminishing returns: sqrt curve so impact is larger when gap is big
  const raw = maxImpact * (gap / maxScore)
  return Math.max(1, Math.round(raw))
}

function calcPercentile(impact: number, maxImpact: number): string {
  const pct = (impact / maxImpact) * 100
  if (pct <= 0) return '+0%'
  const lo = Math.max(1, Math.round(pct * 0.5))
  const hi = Math.round(pct)
  return `+${lo}~${hi}%`
}

function getEffort(category: string, gap: number): 'EASY' | 'MEDIUM' | 'HARD' {
  if (gap <= 0) return 'EASY'
  if (category === 'website') return 'MEDIUM'
  if (category === 'knowledge' && gap > 40) return 'HARD'
  if (gap > 50) return 'MEDIUM'
  return 'EASY'
}

// ── Task definitions ──

const taskRegistry: TaskDef[] = [
  {
    priority: 'HIGH',
    category: 'visibility',
    title: '完善品牌信息',
    description: '补充品牌名称、官网链接、品牌描述等基础信息以提高 AI 可见度',
    reason: '当前 AI 可见度较低，品牌基础信息不完整影响搜索引擎和 AI 系统的识别能力',
    effort: 'EASY',
    prerequisites: [],
    gapCondition: (s) => Math.max(0, 60 - s.breakdown.visibility.score),
    maxImpact: 30,
  },
  {
    priority: 'HIGH',
    category: 'knowledge',
    title: '补充知识内容',
    description: '添加更多品牌相关知识条目（产品、技术、历史等），丰富知识库',
    reason: '知识条目数量不足，AI 系统缺乏足够的品牌上下文信息来准确回答用户问题',
    effort: 'MEDIUM',
    prerequisites: ['完善品牌信息'],
    gapCondition: (s) => Math.max(0, 60 - s.breakdown.knowledge.score),
    maxImpact: 35,
  },
  {
    priority: 'HIGH',
    category: 'website',
    title: '完善官网信息',
    description: '确保官网可访问、完成官网扫描并提取结构化数据',
    reason: '官网是 AI 系统获取品牌信息的主要来源，官网信息不完整会严重影响 AI 可信度',
    effort: 'MEDIUM',
    prerequisites: ['完善品牌信息'],
    gapCondition: (s) => Math.max(0, 60 - s.breakdown.website.score),
    maxImpact: 30,
  },
  {
    priority: 'MEDIUM',
    category: 'authority',
    title: '增加事实与来源',
    description: '添加更多品牌事实声明和引用来源以提升权威性和可信度',
    reason: '权威性不足意味着 AI 系统难以找到足够的证据来支持品牌相关陈述',
    effort: 'MEDIUM',
    prerequisites: ['完善品牌信息', '完善官网信息'],
    gapCondition: (s) => Math.max(0, 60 - s.breakdown.authority.score),
    maxImpact: 25,
  },
  {
    priority: 'MEDIUM',
    category: 'content',
    title: '优化品牌内容',
    description: '更新品牌描述、补充行业信息、案例和 FAQ 内容',
    reason: '品牌内容深度不够，AI 系统难以生成有说服力的品牌陈述',
    effort: 'MEDIUM',
    prerequisites: ['完善品牌信息'],
    gapCondition: (s) => Math.max(0, 60 - s.breakdown.content.score),
    maxImpact: 20,
  },
  {
    priority: 'LOW',
    category: 'authority',
    title: '建立实体关系网络',
    description: '为品牌实体建立更多的关联关系，构建完整的知识图谱',
    reason: '实体关系网络不完善，AI 难以理解品牌在行业中的定位和关联',
    effort: 'HARD',
    prerequisites: ['增加事实与来源'],
    gapCondition: (s) => Math.max(0, 40 - s.breakdown.authority.score),
    maxImpact: 15,
  },
  {
    priority: 'LOW',
    category: 'knowledge',
    title: '提升知识条目质量',
    description: '对已有知识条目进行质量评分提升，确保置信度达到 0.7 以上',
    reason: '部分知识条目质量偏低，影响 AI 系统对品牌知识的整体评价',
    effort: 'EASY',
    prerequisites: ['补充知识内容'],
    gapCondition: (s) => Math.max(0, 30 - s.breakdown.knowledge.score),
    maxImpact: 10,
  },
  {
    priority: 'MEDIUM',
    category: 'visibility',
    title: '完成关键词扫描',
    description: '启动 AI 关键词扫描，覆盖品牌词、行业词、长尾词等',
    reason: '关键词扫描未完成，AI 系统缺少品牌在互联网中的知名度和提及数据',
    effort: 'EASY',
    prerequisites: ['完善品牌信息'],
    gapCondition: (s) => {
      // Check if there's a '关键词扫描' detail item that's not 'good'
      const details = s.breakdown.visibility.details
      const kwScan = details.find(d => d.label === '关键词扫描')
      if (!kwScan || kwScan.status === 'bad') return 25
      if (kwScan.status === 'neutral') return 10
      return 0
    },
    maxImpact: 20,
  },
  {
    priority: 'MEDIUM',
    category: 'visibility',
    title: '完成官网扫描',
    description: '启动官网扫描，提取品牌官网的结构化信息',
    reason: '官网扫描未完成，AI 系统无法获取最新的品牌官网数据',
    effort: 'EASY',
    prerequisites: ['完善官网信息'],
    gapCondition: (s) => {
      const details = s.breakdown.visibility.details
      const scan = details.find(d => d.label === '官网扫描')
      if (!scan || scan.status === 'bad') return 20
      if (scan.status === 'neutral') return 10
      return 0
    },
    maxImpact: 20,
  },
]

// ── Main generator ──

export async function generateTasks(projectId: string): Promise<TaskWithROI[]> {
  const score = await calculateScore(projectId)
  const tasks: TaskWithROI[] = []

  for (const def of taskRegistry) {
    const gap = def.gapCondition(score)
    if (gap <= 0) continue

    const impact = calcImpact(
      getCurrentScoreForCategory(score, def.category),
      100,
      def.maxImpact
    )
    if (impact <= 0) continue

    const percentile = calcPercentile(impact, def.maxImpact)
    const effort = getEffort(def.category, gap)

    tasks.push({
      priority: def.priority,
      category: def.category,
      title: def.title,
      description: def.description,
      reason: def.reason,
      impact,
      impactPercentile: percentile,
      effort,
      prerequisites: def.prerequisites,
    })
  }

  // Sort: HIGH first, then by impact descending
  return tasks.sort((a, b) => {
    const prioOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    const prioDiff = prioOrder[a.priority] - prioOrder[b.priority]
    if (prioDiff !== 0) return prioDiff
    return b.impact - a.impact
  })
}

function getCurrentScoreForCategory(score: ScoreExplainability, category: string): number {
  switch (category) {
    case 'visibility': return score.breakdown.visibility.score
    case 'authority': return score.breakdown.authority.score
    case 'content': return score.breakdown.content.score
    case 'website': return score.breakdown.website.score
    case 'knowledge': return score.breakdown.knowledge.score
    default: return 50
  }
}
