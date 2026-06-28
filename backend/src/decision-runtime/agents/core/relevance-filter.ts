/**
 * relevance-filter.ts — Phase AG-2.4: Evidence Relevance Filter Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * "净化门" — 在 clustering 之前过滤掉语义错配的证据
 *
 * 解决的核心问题：
 *   query intent ≠ document semantic domain
 *   例: "郑州律师事务所" → 命中 AI 工具评测内容
 *
 * 策略：
 *   1. Keyword Overlap — query 关键词在 evidence 中的覆盖率
 *   2. Domain Mismatch Penalty — 检测明显错配的证据
 *   3. Structured Info Boost — 对地址/电话等结构化信息加分
 *
 * 不做：
 *   ❌ embedding similarity
 *   ❌ LLM-based judge
 *   ❌ 过于激进的过滤（保持 recall）
 *
 * 成功标志：
 *   - 错配证据被有效过滤
 *   - 保留的证据与 query 语义对齐
 *   - confidenceLabel 从 medium 提升到 high
 *
 * @phase decision-runtime / ag-2.4
 */

import { UniversalEvidence } from './universal-evidence.js'

// ============================================================
// 领域错配规则库（随真实数据逐步扩展）
// ============================================================

/**
 * 领域错配检测对
 * key: query 中包含的领域词
 * value: evidence 中如果出现这些词则扣分
 */
const domainMismatchPairs: Array<{ queryPattern: RegExp; penaltyWords: string[]; penalty: number }> = [
  // 法律相关 → 不能出现 AI/科技工具
  { queryPattern: /律师|律所|法律|诉讼|打官司|法院/, penaltyWords: ['kimi', 'deepseek', '豆包', 'chatgpt', 'claude', 'ai', '人工智能', '大模型', 'gpt', 'openai'], penalty: 0.7 },
  
  // 医疗相关 → 不能出现游戏/娱乐
  { queryPattern: /医院|医生|看病|诊所|医疗|挂号|手术/, penaltyWords: ['游戏', '攻略', '娱乐', '明星', '八卦', '电竞'], penalty: 0.7 },
  
  // 本地服务 → 不能出现全球/国际/跨境
  { queryPattern: /附近|郑州|北京|上海|广州|深圳|成都|杭州|本地/, penaltyWords: ['全球', '国际', '跨境', '海外', '出口', '进口'], penalty: 0.5 },
  
  // 餐饮相关 → 不能出现装修/施工
  { queryPattern: /餐厅|饭店|吃饭|美食|火锅|外卖/, penaltyWords: ['装修', '施工', '设计', '建材', '家具'], penalty: 0.6 },
  
  // 教育相关 → 不能出现恋爱/交友
  { queryPattern: /学校|教育|培训|课程|老师|学生|考试/, penaltyWords: ['交友', '恋爱', '婚恋', '相亲'], penalty: 0.7 },

  // 公司查询 → 不能出现租房
  { queryPattern: /公司|企业|注册|法人|信用|资质/, penaltyWords: ['租房', '出租', '求租', '合租'], penalty: 0.6 },
]

// ============================================================
// Relevance Score
// ============================================================

export function relevanceScore(query: string, evidence: UniversalEvidence): number {
  const q = query.toLowerCase()
  const t = `${evidence.title} ${evidence.snippet}`.toLowerCase()

  let score = 0

  // 1. Keyword overlap — query 关键词在 evidence 中出现的比例
  const queryChars = new Set(q.replace(/\s+/g, ''))
  const matchCount = [...queryChars].filter(ch => t.includes(ch)).length
  const overlapRatio = queryChars.size > 0 ? matchCount / queryChars.size : 0
  score += overlapRatio * 0.5

  // 2. Domain mismatch penalty
  for (const pair of domainMismatchPairs) {
    if (!pair.queryPattern.test(q)) continue
    const hasPenalty = pair.penaltyWords.some(w => t.includes(w))
    if (hasPenalty) {
      score -= pair.penalty
    }
  }

  // 3. Structured info boost (地址/电话 = 高可信度信号)
  if (/(地址|电话|联系方式|官网|营业时间|邮编|邮箱|网址)/.test(t)) {
    score += 0.3
  }

  // 4. Exact title boost — evidence 标题直接包含 query 核心词
  const queryTerms = q.split(/[\s,，、]+/).filter(s => s.length >= 2)
  const titleMatch = queryTerms.filter(term => evidence.title.toLowerCase().includes(term)).length
  if (titleMatch >= 1) score += 0.2

  // 5. Negative penalty for extremely short or generic snippets
  if (evidence.snippet.length < 30) score -= 0.2
  if (/(登录|注册|验证码|密码|记住我|下次自动登录)/.test(t)) score -= 0.3

  return Math.round(score * 1000) / 1000
}

// ============================================================
// Filtering Gate
// ============================================================

export interface RelevanceFilterResult {
  kept: UniversalEvidence[]
  filtered: UniversalEvidence[]
  stats: {
    total: number
    kept: number
    filtered: number
    keepRate: number
    avgRelevance: number
  }
}

/**
 * 证据相关性过滤
 * 
 * @param query 原始用户查询
 * @param evidences 待过滤的证据列表
 * @param threshold 保留阈值（默认 0.2）
 * @returns 过滤结果
 */
export function filterEvidence(
  query: string,
  evidences: UniversalEvidence[],
  threshold: number = 0.2
): RelevanceFilterResult {
  const scored = evidences.map(ev => ({
    evidence: ev,
    relevance: relevanceScore(query, ev),
  }))

  const kept: UniversalEvidence[] = []
  const filtered: UniversalEvidence[] = []

  for (const item of scored) {
    if (item.relevance > threshold) {
      kept.push(item.evidence)
    } else {
      filtered.push(item.evidence)
    }
  }

  const total = evidences.length
  const avgRelevance = total > 0
    ? scored.reduce((sum, s) => sum + s.relevance, 0) / total
    : 0

  console.log(`[RelevanceFilter] ${total} 条 → 保留 ${kept.length} 条 (${((kept.length / total) * 100).toFixed(0)}%) | avgRelevance=${avgRelevance.toFixed(3)}`)

  return {
    kept,
    filtered,
    stats: {
      total,
      kept: kept.length,
      filtered: filtered.length,
      keepRate: total > 0 ? Math.round((kept.length / total) * 100) / 100 : 0,
      avgRelevance: Math.round(avgRelevance * 1000) / 1000,
    },
  }
}
