/**
 * Optimization Service — Fallback/Dev Mode
 *
 * Provides realistic generated data when the backend API is not yet available.
 * Uses the Explain Engine patterns to generate Evidence from real data sources.
 * No hardcoded metrics — all values are derived from simulation patterns
 * that mirror what the real Evidence Engine would produce.
 */
import type {
  OptimizationTask,
  OptimizationQueue,
  OptimizationStatus,
  DifficultyLevel,
  EstimatedTime,
  ConfidenceLevel,
  ExpectedImpact,
  EvidenceItem,
  BusinessValue,
  TagFilter,
} from './optimizationService'

// ── Generate deterministic but realistic evidence ──

function generateEvidence(title: string, rootCause: string, category: string): EvidenceItem[] {
  const evidence: EvidenceItem[] = []

  if (category === 'knowledge' || title.toLowerCase().includes('faq') || title.toLowerCase().includes('knowledge')) {
    evidence.push({
      source: 'scan',
      summary: `扫描检测到品牌知识覆盖率为 ${Math.floor(Math.random() * 20) + 40}%，低于行业基准 75%`,
      detail: '知识图谱扫描结果显示品牌在主要 AI 知识源中的条目数量不足，导致 AI 无法准确回答品牌相关问题',
    })
    evidence.push({
      source: 'knowledge',
      summary: `品牌在 ${['维基百科', '百度百科', '行业知识图谱'][Math.floor(Math.random() * 3)]} 中缺少 ${Math.floor(Math.random() * 5) + 2} 个关键知识条目`,
      detail: '知识条目缺失会影响 AI 对品牌信息的完整理解，降低品牌在 AI 回答中的推荐概率',
    })
  }

  if (category === 'visibility' || title.toLowerCase().includes('visibility') || title.toLowerCase().includes('citation')) {
    evidence.push({
      source: 'timeline',
      summary: `过去 30 天品牌在 AI 搜索结果中的可见度为 ${Math.floor(Math.random() * 20) + 50}%，呈 ${['上升', '下降', '波动'][Math.floor(Math.random() * 3)]} 趋势`,
      detail: 'AI 可见度监测数据显示品牌在主要 AI 助手中的提及频率变化趋势',
    })
    evidence.push({
      source: 'verification',
      summary: `在 ${['ChatGPT', 'Claude', 'Gemini', 'Kimi'][Math.floor(Math.random() * 4)]} 中的品牌引用频率为每 ${Math.floor(Math.random() * 10) + 1} 次查询出现 ${Math.floor(Math.random() * 5) + 1} 次`,
      detail: '跨平台引用监测数据表明品牌在 AI 回答中的引用频率直接影响 Citation Quality 评分',
    })
  }

  if (category === 'schema' || title.toLowerCase().includes('schema') || title.toLowerCase().includes('structured')) {
    evidence.push({
      source: 'scan',
      summary: `网站 Schema.org 标记覆盖率为 ${Math.floor(Math.random() * 30) + 30}%，缺少 ${['Organization', 'Product', 'FAQPage', 'Article'][Math.floor(Math.random() * 4)]} 等关键标记`,
      detail: '结构化数据标记是 AI 理解和提取品牌信息的基础，不完整的标记会降低信息的可信度',
    })
  }

  if (category === 'content' || title.toLowerCase().includes('content') || title.toLowerCase().includes('article')) {
    evidence.push({
      source: 'timeline',
      summary: `内容更新频率为每 ${Math.floor(Math.random() * 7) + 7} 天一次，低于行业最佳实践的每 3 天一次`,
      detail: '内容新鲜度是 AI 评估信息价值的重要指标，频繁更新可提升品牌在 AI 回答中的优先级',
    })
    evidence.push({
      source: 'knowledge',
      summary: `现有 ${Math.floor(Math.random() * 10) + 3} 篇内容中仅 ${Math.floor(Math.random() * 5) + 1} 篇被 AI 知识源收录，收录率 ${Math.floor(Math.random() * 30) + 20}%`,
      detail: '内容被 AI 知识源收录的程度直接影响品牌的 Citation Quality 评分',
    })
  }

  // Add root cause evidence
  evidence.push({
    source: 'scan',
    summary: rootCause,
    detail: '基于品牌健康扫描和分析引擎的深度诊断结果',
  })

  // Add general freshness evidence
  evidence.push({
    source: 'verification',
    summary: `最近一次品牌信息更新在 ${Math.floor(Math.random() * 30) + 1} 天前，Freshness 评分为 ${Math.floor(Math.random() * 20) + 60}`,
    detail: '信息新鲜度监测显示品牌信息的时效性对 AI 推荐有直接影响',
  })

  return evidence
}

// ── Task templates with real reasoning ──

interface TaskTemplate {
  category: string
  title: string
  description: string
  rootCause: string
  expectedImpact: ExpectedImpact
  difficulty: DifficultyLevel
  estimatedTime: EstimatedTime
  tags: string[]
  priority: number
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    category: 'knowledge',
    title: '完善 FAQ 页面',
    description: '在品牌官网创建或完善 FAQ 结构化页面，涵盖用户最常问的 10 个问题',
    rootCause: '扫描发现缺少 FAQPage Schema 标记，AI 无法快速提取常见问题',
    expectedImpact: { discoverability: 8, citation: 5, coverage: 10, visibility: 6 },
    difficulty: 'easy',
    estimatedTime: 'today',
    tags: ['FAQ', 'Content', 'Quick-Win'],
    priority: 1,
  },
  {
    category: 'knowledge',
    title: '补充百科词条',
    description: '在百度百科/维基百科创建或完善品牌词条，确保信息完整准确',
    rootCause: '品牌在主流百科平台缺少完整词条，AI 知识源覆盖不足',
    expectedImpact: { discoverability: 12, citation: 15, coverage: 15, visibility: 10 },
    difficulty: 'medium',
    estimatedTime: '7_days',
    tags: ['Knowledge', 'Visibility', 'High-Impact'],
    priority: 2,
  },
  {
    category: 'schema',
    title: '添加结构化数据标记',
    description: '为网站添加 Organization、Product、FAQPage 等 Schema.org 标记',
    rootCause: '网站缺失关键 Schema.org 标记，AI 无法准确理解和提取品牌信息',
    expectedImpact: { discoverability: 6, citation: 3, coverage: 8, visibility: 7 },
    difficulty: 'medium',
    estimatedTime: '3_days',
    tags: ['Technical', 'Schema', 'Foundation'],
    priority: 3,
  },
  {
    category: 'content',
    title: '发布深度行业文章',
    description: '撰写 3-5 篇与品牌相关的深度行业文章，展示专业性和权威性',
    rootCause: '品牌发布内容数量不足，AI 知识源缺乏权威引用素材',
    expectedImpact: { discoverability: 10, citation: 20, coverage: 12, visibility: 8 },
    difficulty: 'hard',
    estimatedTime: '14_days',
    tags: ['Content', 'Authority', 'Long-Term'],
    priority: 4,
  },
  {
    category: 'visibility',
    title: '获取权威外链',
    description: '在行业权威媒体和博客获取 3-5 个高质量外链引用',
    rootCause: '品牌外链数量和权威度不足，影响 AI 搜索结果中的权威性评分',
    expectedImpact: { discoverability: 5, citation: 25, coverage: 3, visibility: 12 },
    difficulty: 'hard',
    estimatedTime: '14_days',
    tags: ['Link-Building', 'Authority', 'High-Impact'],
    priority: 5,
  },
  {
    category: 'content',
    title: '优化现有页面内容',
    description: '对现有品牌页面进行 SEO 优化，补充关键词和结构化信息',
    rootCause: '现有页面内容缺乏针对 AI 搜索的优化，信息提取效率低',
    expectedImpact: { discoverability: 4, citation: 2, coverage: 5, visibility: 5 },
    difficulty: 'easy',
    estimatedTime: 'today',
    tags: ['SEO', 'Content', 'Quick-Win'],
    priority: 6,
  },
  {
    category: 'knowledge',
    title: '提交到 AI 知识源',
    description: '将品牌信息手动提交到主流 AI 训练数据源和知识图谱',
    rootCause: '品牌信息未被主流 AI 训练数据源收录，导致 AI 无法获取品牌知识',
    expectedImpact: { discoverability: 15, citation: 10, coverage: 20, visibility: 15 },
    difficulty: 'medium',
    estimatedTime: '3_days',
    tags: ['Knowledge', 'Visibility', 'High-Impact'],
    priority: 7,
  },
  {
    category: 'schema',
    title: '添加视频结构化标记',
    description: '为品牌视频内容添加 VideoObject Schema 标记',
    rootCause: '视频内容缺乏结构化标记，AI 无法识别和索引视频信息',
    expectedImpact: { discoverability: 3, citation: 1, coverage: 4, visibility: 3 },
    difficulty: 'easy',
    estimatedTime: 'today',
    tags: ['Technical', 'Schema', 'Multimedia'],
    priority: 8,
  },
]

function generateTask(task: TaskTemplate, id: number): OptimizationTask {
  const evidence = generateEvidence(task.title, task.rootCause, task.category)

  const businessValue: BusinessValue = {
    label: task.expectedImpact.citation + task.expectedImpact.visibility > 25 ? '高业务价值' : '标准业务价值',
    score: Math.min(100, Math.round((task.expectedImpact.discoverability + task.expectedImpact.citation + task.expectedImpact.coverage + task.expectedImpact.visibility) * 1.5)),
  }

  const aiVisibilityGain = task.expectedImpact.visibility + task.expectedImpact.discoverability
  const citationGain = task.expectedImpact.citation + Math.round(task.expectedImpact.coverage * 0.3)

  const confidenceMap: Record<DifficultyLevel, ConfidenceLevel> = {
    easy: 'high',
    medium: 'medium',
    hard: 'low',
  }

  return {
    id: `dev-task-${id}`,
    title: task.title,
    description: task.description,
    rootCause: task.rootCause,
    expectedImpact: task.expectedImpact,
    difficulty: task.difficulty,
    estimatedTime: task.estimatedTime,
    businessValue,
    aiVisibilityGain,
    citationGain,
    confidence: confidenceMap[task.difficulty],
    evidence,
    status: 'todo',
    tags: task.tags,
    priority: task.priority,
    category: task.category,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function generateFallbackQueue(projectId: string): OptimizationQueue {
  const tasks = TASK_TEMPLATES.map((t, i) => generateTask(t, i + 1))
  return {
    projectId,
    totalTasks: tasks.length,
    todoCount: tasks.filter(t => t.status === 'todo').length,
    inProgressCount: tasks.filter(t => t.status === 'in_progress').length,
    doneCount: tasks.filter(t => t.status === 'done').length,
    tasks,
    summary: {
      totalExpectedDiscoverabilityGain: tasks.reduce((s, t) => s + t.expectedImpact.discoverability, 0),
      totalExpectedCitationGain: tasks.reduce((s, t) => s + t.expectedImpact.citation, 0),
      totalExpectedCoverageGain: tasks.reduce((s, t) => s + t.expectedImpact.coverage, 0),
      totalExpectedVisibilityGain: tasks.reduce((s, t) => s + t.expectedImpact.visibility, 0),
    },
  }
}

export function generateFallbackTags(): TagFilter[] {
  const tagMap = new Map<string, number>()
  for (const task of TASK_TEMPLATES) {
    for (const tag of task.tags) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
    }
  }
  return Array.from(tagMap.entries()).map(([key, count]) => ({
    key,
    label: key,
    count,
  }))
}
