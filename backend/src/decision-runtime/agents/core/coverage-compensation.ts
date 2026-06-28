/**
 * coverage-compensation.ts — Phase AG-2.5: Evidence Source Compensation Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * 当 web source coverage 不足时，自动识别信息缺口并补偿查询策略
 *
 * 核心任务：
 *   1. Coverage Detection — 检测结构化信息（地址/电话/评价）的覆盖率
 *   2. Adaptive Query Regeneration — 针对缺口生成补偿查询
 *   3. Source-Aware Confidence Adjustment — 根据覆盖度调整置信度
 *
 * 不做：
 *   ❌ 接入高德/天眼查等外部结构化数据源
 *   ❌ embedding-based gap detection
 *   ❌ LLM-based gap assessment
 *
 * 成功标志：
 *   - 检测到 coverage gap 后能自动生成补偿查询
 *   - 补偿后的证据集包含更多结构化信息
 *   - 系统知道“自己不知道什么”
 *
 * @phase decision-runtime / ag-2.5
 */

import { UniversalEvidence } from './universal-evidence.js'
import { IntentResult } from './intent-router.js'

// ============================================================
// 补偿策略配置
// ============================================================

interface CompensationStrategy {
  domainPattern: RegExp
  compensations: Array<{
    suffix: string           // 附加到 query 后的搜索后缀
    targetInfo: string       // 期望补什么信息
    priority: number         // 优先级（1最高）
  }>
}

const compensationStrategies: CompensationStrategy[] = [
  {
    // 本地实体查询 → 缺名单/排名/联系方式
    domainPattern: /本地|附近|郑州|北京|上海|广州|深圳|成都|杭州|武汉|南京|长沙|天津|重庆/,
    compensations: [
      { suffix: '推荐 排名 2025', targetInfo: '排名/口碑', priority: 1 },
      { suffix: '口碑 评价 怎么样', targetInfo: '用户评价', priority: 2 },
      { suffix: '地址 电话 联系方式', targetInfo: '联系方式', priority: 3 },
    ],
  },
  {
    // 法律服务/专业服务 → 缺名单/评价/资质
    domainPattern: /律师|律所|法律|诉讼|打官司|法院|会计|审计|税务|咨询/,
    compensations: [
      { suffix: '推荐 排名 哪家好', targetInfo: '排名推荐', priority: 1 },
      { suffix: '口碑 评价 点评', targetInfo: '用户评价', priority: 2 },
      { suffix: '地址 电话 官网', targetInfo: '联系方式', priority: 3 },
    ],
  },
  {
    // 医疗服务 → 缺预约/评价/科室
    domainPattern: /医院|医生|看病|诊所|医疗|挂号|手术|牙科|眼科/,
    compensations: [
      { suffix: '排名 推荐 哪个好', targetInfo: '排名推荐', priority: 1 },
      { suffix: '评价 口碑 怎么样', targetInfo: '患者评价', priority: 2 },
      { suffix: '地址 电话 预约', targetInfo: '联系方式/预约', priority: 3 },
    ],
  },
  {
    // 餐饮/生活服务 → 缺评价/地址
    domainPattern: /餐厅|饭店|吃饭|美食|火锅|外卖|咖啡|奶茶|酒吧|KTV/,
    compensations: [
      { suffix: '推荐 排名 2025', targetInfo: '推荐排名', priority: 1 },
      { suffix: '地址 电话 营业时间', targetInfo: '地址/营业信息', priority: 2 },
    ],
  },
  {
    // 产品评测 → 缺对比/参数/价格
    domainPattern: /推荐|评测|对比|选购|怎么样|哪个好|性价比/,
    compensations: [
      { suffix: '参数 价格 2025', targetInfo: '参数/价格', priority: 1 },
      { suffix: '评测 优缺点 对比', targetInfo: '评测对比', priority: 2 },
      { suffix: '购买 渠道 京东 天猫', targetInfo: '购买渠道', priority: 3 },
    ],
  },
]

// ============================================================
// 1. Coverage Detector
// ============================================================

/**
 * 检测结构化信息的覆盖率
 * 
 * @param evidences 当前证据集
 * @returns 是否检测到 coverage gap（结构化信息不足）
 */
export function detectCoverageGap(evidences: UniversalEvidence[]): boolean {
  if (evidences.length === 0) return true

  // 统计含有结构化信息的证据比例
  const structuredKeywords = /地址|电话|评价|推荐|排名|价格|联系方式|官网|网址|电话|地址|营业|邮箱|预约|口碑/
  
  const structuredCount = evidences.filter(e =>
    structuredKeywords.test(e.snippet) || structuredKeywords.test(e.title)
  ).length

  const total = evidences.length
  const structuredRatio = structuredCount / total

  console.log(`[Coverage] 结构化信息: ${structuredCount}/${total} (${(structuredRatio * 100).toFixed(0)}%)`)

  // 不足 30% 视为 coverage gap
  return structuredRatio < 0.3
}

// ============================================================
// 2. Adaptive Query Regeneration
// ============================================================

export interface CompensationQuery {
  query: string
  targetInfo: string
  priority: number
}

/**
 * 如果检测到 coverage gap，生成补偿查询
 * 
 * @param query 原始用户查询
 * @param intent 意图分析结果
 * @returns 补偿查询列表（空数组表示不需要补偿）
 */
export function regenerateQueriesIfNeeded(
  query: string,
  intent: IntentResult | null
): CompensationQuery[] {
  const q = query.toLowerCase()

  for (const strategy of compensationStrategies) {
    if (!strategy.domainPattern.test(q)) continue

    return strategy.compensations.map(c => ({
      query: `${q} ${c.suffix}`,
      targetInfo: c.targetInfo,
      priority: c.priority,
    }))
  }

  // 如果无匹配策略，返回通用补偿
  return [
    { query: `${q} 推荐`, targetInfo: '推荐信息', priority: 1 },
    { query: `${q} 对比 评价`, targetInfo: '评价信息', priority: 2 },
  ]
}

// ============================================================
// 3. Source-Aware Confidence Adjustment
// ============================================================

/**
 * 根据 coverage 情况调整置信度
 * 
 * @param baseConfidence 基础置信度
 * @param coverageGap 是否存在 coverage gap
 * @returns 调整后的置信度
 */
export function adjustConfidence(baseConfidence: number, coverageGap: boolean): number {
  if (!coverageGap) return baseConfidence
  // 覆盖不足时降级 30%
  return Math.round(baseConfidence * 0.7 * 1000) / 1000
}

// ============================================================
// 3.5 Coverage Confidence（AG-6.1 区分 True Gap / Sufficient）
// ============================================================

/**
 * 区分 True Gap 和 Low Confidence But Sufficient
 * 
 * True Gap = coverage gap + 证据量不足以做出判断
 * Sufficient = coverage gap 存在但证据量足够（系统在低估自己）
 *
 * 返回 0~1: 
 *   >0.2 → True Gap（需要补偿）
 *   ≤0.2 → Sufficient（可以放宽）
 */
export function computeCoverageConfidence(evidences: UniversalEvidence[]): number {
  if (evidences.length === 0) return 0.8

  const structuredKeywords = /地址|电话|评价|推荐|排名|价格|联系方式|官网|网址|营业|邮箱|预约|口碑/
  const structuredCount = evidences.filter(e =>
    structuredKeywords.test(e.snippet) || structuredKeywords.test(e.title)
  ).length

  const ratio = structuredCount / evidences.length

  // 证据量足够但结构化比例低 → 可能是 Sufficient
  const evidenceSufficiency = Math.min(1, evidences.length / 8)
  const gapConfidence = Math.max(0, 0.3 - ratio)

  // 加权：证据量足够时，gap 置信度降低
  const adjusted = gapConfidence * (1 - evidenceSufficiency * 0.5)

  return Math.round(Math.min(0.95, Math.max(0, adjusted)) * 1000) / 1000
}

// ============================================================
// 4. Full Coverage Compensation Pipeline
// ============================================================

export interface CoverageCompensationResult {
  hasGap: boolean
  structuredRatio: number
  compensations: CompensationQuery[]
  adjustedConfidence: number
  coverageConfidence: number   // AG-6.1
}

/**
 * 完整的 coverage compensation pipeline
 * 
 * @param query 原始用户查询
 * @param baseConfidence 当前阶段的基础置信度
 * @param evidences 当前证据集
 * @param intent 意图分析结果
 * @returns 补偿建议 + 状态信息
 */
export function coverageCompensate(
  query: string,
  baseConfidence: number,
  evidences: UniversalEvidence[],
  intent: IntentResult | null
): CoverageCompensationResult {
  const hasGap = detectCoverageGap(evidences)
  const structuredCount = evidences.filter(e =>
    /地址|电话|评价|推荐|排名|价格|联系方式|官网/.test(e.snippet + e.title)
  ).length
  const ratio = evidences.length > 0 ? structuredCount / evidences.length : 0

  const compensations = hasGap ? regenerateQueriesIfNeeded(query, intent) : []
  const adjustedConf = adjustConfidence(baseConfidence, hasGap)
  const covConf = computeCoverageConfidence(evidences)

  console.log(`[CoverageCompensate] gap=${hasGap} | 结构化=${(ratio * 100).toFixed(0)}%` +
    ` | 补偿=${compensations.length} 条 | 置信度 ${baseConfidence}→${adjustedConf}` +
    ` | 覆盖置信度=${covConf}` +
    (covConf <= 0.2 ? ' (低置信但已足够, 补偿可能过度)' : covConf > 0.2 ? ' (真实信息缺口)' : ''))

  return {
    hasGap,
    structuredRatio: Math.round(ratio * 1000) / 1000,
    compensations,
    adjustedConfidence: adjustedConf,
    coverageConfidence: covConf,
  }
}
