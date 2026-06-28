/**
 * deterministic-transform.ts — Phase A-3.0 确定性转换核心
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0: Agent Deterministic Core
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件提供所有 Agent 使用的确定性工具函数。
 *
 * 规则：
 *   1. 所有函数必须是纯函数（相同输入永远相同输出）
 *   2. 禁止使用生成式 AI
 *   3. 禁止随机数
 *   4. 禁止日期/时间戳相关逻辑（除非 input 本身带时间）
 *   5. 所有输出必须与输入一一对应
 *
 * @phase decision-runtime
 */

import { DecisionDomain, DOMAIN_EVALUATION_AXES, detectDomain } from '../../cognition/decision-problem.js'
import type { DecisionProblem } from '../../cognition/decision-problem.js'

// ============================================================
// 1. 文本 → DecisionProblem（确定性分解）
// ============================================================

/**
 * 将用户输入分解为 DecisionProblem
 * 纯规则驱动，禁止 LLM
 */
export function parseToDecisionProblem(rawInput: string): DecisionProblem {
  const domain = detectDomain(rawInput)
  const axes = DOMAIN_EVALUATION_AXES[domain]

  const constraints: string[] = []
  const objectives: string[] = []

  // 确定性约束提取（纯关键词匹配）
  constraintPatterns.forEach(([pattern, extract]) => {
    const match = rawInput.match(pattern)
    if (match) {
      const constraint = extract(match)
      if (constraint && !constraints.includes(constraint)) {
        constraints.push(constraint)
      }
    }
  })

  // 确定性目标提取
  objectivePatterns.forEach(([pattern, extract]) => {
    const match = rawInput.match(pattern)
    if (match) {
      const objective = extract(match)
      if (objective && !objectives.includes(objective)) {
        objectives.push(objective)
      }
    }
  })

  // 意图提取（前缀匹配）
  const intent = extractIntent(rawInput)

  // 优先级排序：约束 > 目标
  const priorityOrder = [...constraints, ...objectives]

  return {
    rawInput,
    domain,
    intent,
    constraints,
    objectives,
    priorityOrder,
  }
}

// ============================================================
// 2. 约束提取模式
// ============================================================

const constraintPatterns: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
  // 预算
  [/预算(\d+万?元?)/, m => `预算: ${m[1]}`],
  [/预算(\d+-\d+万?元?)/, m => `预算: ${m[1]}`],
  [/(\d+)万(预算)?/, m => `预算: ${m[1]}万`],
  [/budget[:\s]*(\d+)/i, m => `预算: ${m[1]}`],

  // 城市
  [/(北京|上海|广州|深圳|杭州|成都|武汉|南京|重庆|天津|苏州|西安|长沙|郑州|东莞|青岛|沈阳|宁波|昆明|大连|厦门|合肥|佛山|福州|哈尔滨|济南|温州|长春|石家庄|常州|无锡|南宁|贵阳|太原|南昌|中山|惠州|海口|兰州|珠海|乌鲁木齐|绍兴|徐州|烟台|金华|泉州|漳州|嘉兴|台州|镇江|扬州|银川|西宁|拉萨|呼和浩特|秦皇岛|洛阳|南阳|襄阳|宜昌|岳阳|柳州|桂林|遵义|赣州|九江|安庆|芜湖)/, m => `城市: ${m[1]}`],

  // 面积
  [/(\d+)(平米|平方|㎡|m²|平方米)/, m => `面积: ${m[1]}㎡`],

  // 时间
  [/(\d+)年(内|以内|前)/, m => `时间限制: ${m[1]}年内`],
  [/(尽快|急|加急)/, m => '时间: 加急'],
  [/(周末|工作日)/i, m => `时间: ${m[0]}`],

  // 地段/区域
  [/(学区|地铁|商圈|市中心|郊区|开发区)/, m => `地段要求: ${m[1]}`],

  // 人数
  [/(\d+)人(以[上下])?/, (m) => {
    const suffix = m[2] || ''
    return `人数: ${m[1]}人${suffix}`
  }],
]

// ============================================================
// 3. 目标提取模式
// ============================================================

const objectivePatterns: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
  [/(买|购置|购买|购)/, () => '购买'],
  [/(租|租赁|出租)/, () => '租赁'],
  [/(找|寻找|搜索|查询)/, () => '寻找'],
  [/(咨询|询问|了解)/, () => '咨询'],
  [/(比较|对比|对比分析)/, () => '比较分析'],
  [/(推荐|建议|选择)/, () => '获取推荐'],
  [/(投资|升值|回报)/, () => '投资'],
]

// ============================================================
// 4. 意图提取（确定性前缀匹配）
// ============================================================

/**
 * 从原始输入中通过前缀规则提取意图
 * 无 AI、无语义理解、无模糊匹配
 */
function extractIntent(rawInput: string): string {
  const trimmed = rawInput.trim()

  const intentPatterns: Array<[RegExp, string]> = [
    [/我想(买|租|找|了解|咨询|知道).+/, '用户有明确购买/租赁/咨询需求'],
    [/推荐.+/, '用户需要推荐建议'],
    [/怎么(样|选|办|做).+/, '用户需要决策建议'],
    [/哪个(好|合适|划算).+/, '用户需要比较决策'],
    [/预算.+/, '用户有预算限制的决策需求'],
    [/.+怎么样/, '用户需要评价分析'],
    [/有什么(好|推荐|选择).+/, '用户需要选项推荐'],
    [/帮(我|忙|我看).+/, '用户请求辅助决策'],
    [/对比.+/, '用户需要对比分析'],
  ]

  for (const [pattern, intent] of intentPatterns) {
    if (pattern.test(trimmed)) {
      return intent
    }
  }

  return '一般决策咨询'
}

// ============================================================
// 5. 搜索查询生成（确定性规则）
// ============================================================

/**
 * 从 DecisionProblem 生成确定性搜索查询
 * P1.2: 移除 seed conditional exclusive path
 * seed 不再生成/替换 query，只做 rerank（见 seed-rerank.ts）
 * expansion 始终 deterministic，不受 seed 影响
 */
export function generateSearchQueries(problem: DecisionProblem, bias?: {
  seed?: string
  domain?: string
}): string[] {
  const { domain, constraints, objectives } = problem

  // ===== P1.2: Seed 不参与 query generation =====
  // seed 只做 ranking bias（seed-rerank.ts），不替换/生成 search query
  // expansion 永远 deterministic

  const city = constraints.find(c => c.startsWith('城市:'))
  const budget = constraints.find(c => c.startsWith('预算:'))
  const locationReq = constraints.find(c => c.startsWith('地段要求:'))

  const domainTerms: Record<string, string[]> = {
    [DecisionDomain.REAL_ESTATE]: ['房产', '楼盘', '房价'],
    [DecisionDomain.LEGAL]: ['律师事务所', '律师', '法律咨询'],
    [DecisionDomain.MEDICAL]: ['医院', '诊所', '医生'],
    [DecisionDomain.EDUCATION]: ['学校', '培训机构', '教育'],
    [DecisionDomain.TRAVEL]: ['旅游', '酒店', '景点'],
    [DecisionDomain.ENTERPRISE]: ['供应商', '企业服务'],
    [DecisionDomain.LIFESTYLE]: ['美容', '美发', '家政'],
    [DecisionDomain.FRANCHISE]: ['加盟', '创业项目'],
    [DecisionDomain.CONSULTING]: ['咨询师', '心理咨询'],
    [DecisionDomain.GENERAL]: ['推荐'],
  }

  const terms = domainTerms[domain as DecisionDomain] || domainTerms[DecisionDomain.GENERAL]
  const queries: string[] = []

  // 基础查询
  if (city && budget) {
    queries.push(`${terms[0]} ${city.replace('城市:', '')} ${budget.replace('预算:', '')}`)
  }
  if (city && locationReq) {
    queries.push(`${terms[0]} ${city.replace('城市:', '')} ${locationReq.replace('地段要求:', '')}`)
  }
  if (city) {
    queries.push(...terms.slice(0, 3).map(t => `${t} ${city.replace('城市:', '')}`))
  }

  // 如果没有城市匹配，做一般查询
  if (queries.length === 0) {
    queries.push(...terms.slice(0, 2))
    if (budget) queries.push(budget.replace('预算:', ''))
    // 添加一句标准化表达
    const objectivesStr = objectives.join(' ')
    if (objectivesStr) queries.push(`${objectivesStr} ${terms[0]}`)
  }

  // P1.2: 始终包含 raw query 作为 anchor（seed 不再替换 search space）
  // 优先用 problem.rawInput（完整原句），fallback objectives
  const rawQuery = problem.rawInput || objectives.join(' ')
  if (rawQuery && !queries.includes(rawQuery)) {
    queries.unshift(rawQuery)
  }

  return queries
}

// ============================================================
// P0.10: Seed-Driven Query Builder
// 当 seed 命中时，用 seed 的 domain 信息生成针对性检索 query
// 比纯 domain term 模板更精准
// ============================================================

const SEED_QUERY_TEMPLATES: Record<string, (problem: DecisionProblem, domain: string) => string[]> = {
  // local food recommendation
  'local_food_recommendation': (p, d) => {
    const city = p.constraints.find(c => c.startsWith('城市:'))?.replace('城市:', '') || ''
    return [
      `${city} 美食推荐 排行榜`,
      `${city} 好吃 餐厅 推荐`,
      `${city} 特色小吃 必吃`,
      `best restaurants in ${city || d}`,
    ].filter(q => q.trim())
  },
  // local travel attraction
  'local_travel_attraction': (p, d) => {
    const city = p.constraints.find(c => c.startsWith('城市:'))?.replace('城市:', '') || ''
    return [
      `${city} 景点推荐`,
      `${city} 旅游攻略`,
      `${city} 必去景点`,
      `things to do in ${city || d}`,
    ].filter(q => q.trim())
  },
  // local travel accommodation
  'local_travel_accommodation': (p, d) => {
    const city = p.constraints.find(c => c.startsWith('城市:'))?.replace('城市:', '') || ''
    return [
      `${city} 住宿推荐`,
      `${city} 酒店推荐`,
      `${city} 民宿 特色`,
      `hotels in ${city || d}`,
    ].filter(q => q.trim())
  },
  // local service recommendation
  'local_service_recommendation': (p, d) => {
    const city = p.constraints.find(c => c.startsWith('城市:'))?.replace('城市:', '') || ''
    return [
      `${city} ${p.objectives.join(' ')} 推荐`,
      `${city} 家政 服务 评价`,
      `${city} 驾校 口碑`,
      `${city} 幼儿园 排名`,
    ].filter(q => q.trim())
  },
  // product comparison/review
  'product-comparison': (p, d) => {
    const terms = p.objectives.join(' ')
    return [
      `${terms} 对比`,
      `${terms} 评测`,
      `${terms} 哪个好`,
      `${terms} comparison review`,
    ].filter(q => q.trim())
  },
  // phone general review
  'phone-general-review': (p, d) => {
    const brand = p.objectives[0] || '手机'
    return [
      `${brand} 手机 评测`,
      `${brand} 手机 性价比`,
      `${brand} 值得买吗`,
      `${brand} review best`,
    ].filter(q => q.trim())
  },
  // huawei phone
  'huawei-phone': (p, d) => {
    return [
      '华为手机 最新 评测',
      '华为手机 2026 推荐',
      'Huawei phone review 2026',
    ].filter(q => q.trim())
  },
  // computer general
  'computer-general': (p, d) => {
    return [
      '电脑 推荐 性价比',
      '笔记本 评测 对比',
      'best laptop 2026',
    ].filter(q => q.trim())
  },
  // iphone
  'iphone': (p, d) => {
    return [
      'iPhone 最新 评测',
      'iPhone 值得买吗',
      'iPhone review comparison',
    ].filter(q => q.trim())
  },
  // book recommendation
  'book-recommend': (p, d) => {
    const terms = p.objectives.join(' ')
    return [
      `${terms} 推荐 书单`,
      `${terms} 好书`,
      `${terms} 必读`,
      `${terms} best books`,
    ].filter(q => q.trim())
  },
  // diet advice
  'diet-advice': (p, d) => {
    return [
      '健康饮食 建议',
      '营养 食谱 推荐',
      'healthy diet tips',
    ].filter(q => q.trim())
  },
}

function buildSeedDrivenQueries(problem: DecisionProblem, seedId: string, domain: string): string[] {
  const builder = SEED_QUERY_TEMPLATES[seedId]
  if (builder) {
    return builder(problem, domain)
  }

  // seed 没有明确定义检索模板时，退化为 domain keyword + objective 的组合
  const terms: string[] = [domain, ...problem.objectives].filter(Boolean)
  return terms.length > 0
    ? [terms.join(' '), `${terms.join(' ')} 推荐`, `${terms.join(' ')} 排行`]
    : []
}

// ============================================================
// 6. 评分计算（确定性加权）
// ============================================================

import type { AxisScore, EvaluationScoreCard } from '../../cognition/evaluation-schema.js'
import { ScoreLevel, determineScoreLevel, calculateWeightedTotal, Confidence } from '../../cognition/evaluation-schema.js'

/**
 * 从 AxisScore 数组生成 EvaluationScoreCard
 * 纯确定性计算，无 AI
 */
export function buildScoreCard(
  candidateId: string,
  candidateName: string,
  axes: AxisScore[],
  weightMap: Record<string, number>,
): EvaluationScoreCard {
  const total = calculateWeightedTotal(axes, weightMap)

  // 总体置信度 = 各轴置信度加权均值
  let confidenceSum = 0
  let weightSum = 0
  for (const ax of axes) {
    const w = weightMap[ax.axisName] ?? 0
    const confidenceScore: Record<string, number> = {
      high: 1,
      medium: 0.6,
      low: 0.3,
    }
    confidenceSum += (confidenceScore[ax.confidence] ?? 0) * w
    weightSum += w
  }
  const avgConfidence = weightSum > 0 ? confidenceSum / weightSum : 0
  const overallConfidence: Confidence =
    avgConfidence >= 0.8 ? Confidence.HIGH :
    avgConfidence >= 0.5 ? Confidence.MEDIUM :
    Confidence.LOW

  return {
    candidateId,
    candidateName,
    axes,
    total,
    overallConfidence,
    evaluatedAt: '', // A-3.0 不填充时间戳，由 Runtime 在执行时注入
    weightMap,
  }
}

// ============================================================
// 7. 排序（确定性）
// ============================================================

/**
 * 按总分降序排序候选
 * 平局时按加权满分项数量决定
 */
export function sortByScore(candidates: Array<{
  id: string
  score: EvaluationScoreCard
}>): string[] {
  return candidates
    .sort((a, b) => {
      // 按总分降序
      const diff = b.score.total - a.score.total
      if (Math.abs(diff) > 0.5) return diff

      // 平局时：高分轴更多的胜出（score >= 75 的轴数）
      const highAxesA = a.score.axes.filter(ax => ax.score >= 75).length
      const highAxesB = b.score.axes.filter(ax => ax.score >= 75).length
      const highDiff = highAxesB - highAxesA
      if (highAxesB !== highAxesA) return highDiff

      // 再平局：按 ID 字典序（保证确定性）
      return a.id.localeCompare(b.id)
    })
    .map(c => c.id)
}

// ============================================================
// 8. 风险检测（确定性关键词规则）
// ============================================================

/**
 * 从 evidence 中检测风险信号
 * 纯关键词匹配，无 AI
 */
export function detectRiskWarnings(evidences: Array<{
  source: string
  content: string
  credibility: number
}>): string[] {
  const warnings: string[] = []

  const riskPatterns: Array<[RegExp, string]> = [
    [/投诉|纠纷|诉讼|仲裁/, '存在投诉/纠纷记录'],
    [/倒闭|跑路|拖欠|欠薪/, '存在经营异常风险'],
    [/虚假|欺诈|骗|假冒/, '存在虚假宣传风险'],
    [/处罚|罚款|吊销|整改/, '存在行政处罚记录'],
    [/事故|医疗事故|安全事故/, '存在安全事故记录'],
    [/差评|一星|低分/, '存在差评/低分评价'],
    [/过时|老旧|落后/, '存在设施老旧风险'],
    [/割韭菜|智商税/, '存在过度营销风险'],
  ]

  for (const [pattern, warning] of riskPatterns) {
    for (const ev of evidences) {
      if (pattern.test(ev.content)) {
        if (!warnings.includes(warning)) {
          warnings.push(warning)
        }
        break
      }
    }
  }

  return warnings
}

// ============================================================
// 9. 报告模板填充（确定性）
// ============================================================

import type { ContractDecisionReport, ContractRecommendation } from '../../cognition/agent-contract.js'
import type { ReasoningFrame } from '../../cognition/reasoning-frame.js'

/**
 * 从结构化数据生成 Markdown 报告
 * 纯模板填充，无 AI 生成
 */
export function fillReportTemplate(
  problem: DecisionProblem,
  frame: ReasoningFrame,
  candidates: Array<{ id: string; name: string; scoreCard: EvaluationScoreCard }>,
  recommendation: ContractRecommendation,
): ContractDecisionReport {
  const lines: string[] = []

  // 标题
  lines.push(`# 决策分析报告`)
  lines.push(``)
  lines.push(`## 📋 需求分析`)
  lines.push(`- **原始需求**: ${problem.rawInput}`)
  lines.push(`- **领域**: ${problem.domain}`)
  lines.push(`- **意图**: ${problem.intent}`)
  if (problem.constraints.length > 0) {
    lines.push(`- **约束条件**: ${problem.constraints.join('、')}`)
  }
  if (problem.objectives.length > 0) {
    lines.push(`- **目标**: ${problem.objectives.join('、')}`)
  }
  lines.push(``)

  // 评估框架
  lines.push(`## 📐 评估框架`)
  for (const ax of frame.evaluationAxes) {
    lines.push(`- **${ax.name}** (权重 ${(ax.weight * 100).toFixed(0)}%): ${ax.description}`)
  }
  lines.push(``)

  // 评分结果
  lines.push(`## 📊 评分结果`)
  for (const candidate of recommendation.rankedCandidateIds) {
    const c = candidates.find(c => c.id === candidate)
    if (!c || !c.scoreCard) continue
    const card = c.scoreCard
    lines.push(`### ${c.name} — 总分: ${card.total}`)
    for (const ax of card.axes) {
      const bar = '█'.repeat(Math.round(ax.score / 10))
      const empty = '░'.repeat(10 - Math.round(ax.score / 10))
      lines.push(`  ${ax.axisName}: ${bar}${empty} ${ax.score}/100 (${ax.level})`)
    }
    lines.push(``)
  }

  // 推荐
  lines.push(`## 🎯 推荐排序`)
  recommendation.rankedCandidateIds.forEach((id, idx) => {
    const c = candidates.find(c => c.id === id)
    if (c) {
      lines.push(`${idx + 1}. **${c.name}** (总分: ${c.scoreCard?.total ?? 'N/A'})`)
    }
  })
  lines.push(``)

  // 风险警告
  if (recommendation.riskWarnings.length > 0) {
    lines.push(`## ⚠️ 风险提示`)
    for (const warning of recommendation.riskWarnings) {
      lines.push(`- ${warning}`)
    }
    lines.push(``)
  }

  // 建议行动
  if (recommendation.suggestedActions.length > 0) {
    lines.push(`## 💡 建议行动`)
    for (const action of recommendation.suggestedActions) {
      lines.push(`- ${action}`)
    }
    lines.push(``)
  }

  // 评估轴详情
  lines.push(`## 🔍 评估轴说明`)
  for (const ax of frame.evaluationAxes) {
    lines.push(`- **${ax.name}**: ${ax.description}`)
  }

  const content = lines.join('\n')

  return {
    format: 'markdown',
    title: `决策分析报告 — ${problem.rawInput.slice(0, 40)}`,
    summary: `对"${problem.rawInput.slice(0, 60)}"的${recommendation.rankedCandidateIds.length}个候选进行了${frame.evaluationAxes.length}维评估。`,
    content,
    metadata: {
      problem,
      frame,
      evaluatedCandidates: candidates.length,
      scoreCards: candidates.map(c => c.scoreCard!).filter(Boolean),
      recommendation,
      generatedAt: '', // A-3.0 不填充，由 Runtime 注入
    },
  }
}
