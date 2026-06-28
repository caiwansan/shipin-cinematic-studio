/**
 * seed-rerank.ts — P1.2: Seed Re-ranking Injection
 *
 * seed 不再生成或替换 search query，只对 candidates 做 ranking bias。
 *
 * 设计原则:
 *   1. Seed must influence "what to search", not "what was found"
 *   2. Seed never generates queries, only reorders existing space
 *   3. Seed = probability bias layer, not query generator
 *
 * 调用位置:
 *   agent-pipeline.ts 在 generateSearchQueries 之后、search 之前
 *
 * @phase decision-runtime / p1.2
 */

import { DEFAULT_SEEDS, U0Seed } from '../p0/u0-seed-schema.js'

/**
 * 对 search query candidates 做 seed-aware re-ranking
 *
 * @param candidates — 来自 generateSearchQueries 的原始查询候选
 * @param seed — 当前匹配的 seed（可为 null/undefined）
 * @returns 重新排序后的 candidates（不增不减，只改顺序）
 */
export function seedRerank(
  candidates: string[],
  seed?: U0Seed | null,
): string[] {
  if (!seed || !candidates || candidates.length === 0) {
    return candidates
  }

  // seed 只做排序 bias，不做筛选
  return candidates
    .map(q => ({
      q,
      score: semanticMatch(q, seed),
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.q)
}

/**
 * 计算查询与 seed 的语义匹配得分（0~1）
 * 三路信号混合，无 AI，纯规则
 *
 * 权重设计:
 *   - intentMatch x0.5: 查询是否包含 seed 的 queryPatterns（最强信号）
 *   - domainMatch x0.3: 查询是否包含 seed 所在 domain 的领域词
 *   - patternDensity x0.2: 查询中匹配到的 pattern 占比（防长查询过拟合）
 */
function semanticMatch(query: string, seed: U0Seed): number {
  const lowerQuery = query.toLowerCase()

  // 1. intentMatch: queryPatterns 匹配率
  let patternHits = 0
  for (const pattern of seed.queryPatterns) {
    if (lowerQuery.includes(pattern.toLowerCase())) {
      patternHits++
    }
  }
  const intentScore = seed.queryPatterns.length > 0
    ? patternHits / seed.queryPatterns.length
    : 0

  // 2. domainMatch: 利用 DOMAIN_TOKEN_MAP 匹配领域词
  // 从 u0-seed-schema 的 tags 和 domain 信息推断领域
  const domainTags = getDomainTokens(seed.domain)
  let domainHits = 0
  for (const token of domainTags) {
    if (lowerQuery.includes(token)) {
      domainHits++
    }
  }
  const domainScore = domainTags.length > 0
    ? domainHits / Math.min(domainTags.length, 5)  // 最多 5 个 token
    : 0

  // 3. patternDensity: 防止长查询过拟合
  const densityScore = query.length > 20
    ? Math.max(0, patternHits / Math.max(seed.queryPatterns.length, 1))
    : intentScore

  return (
    intentScore * 0.5 +
    Math.min(domainScore, 1.0) * 0.3 +
    densityScore * 0.2
  )
}

/**
 * 根据 domain 获取领域特征词（与 u1-seed-matcher.ts 中的 DOMAIN_TOKEN_MAP 对齐）
 */
function getDomainTokens(domain: string): string[] {
  const tokenMap: Record<string, string[]> = {
    consumer_electronics: ['手机', '电脑', '华为', '苹果', '笔记本', '耳机', '评测'],
    lifestyle: ['推荐', '书', '电影', '健身', '减肥', '饮食', '运动'],
    business_intel: ['公司', '企业', '财报', '融资', '估值', '上市'],
    general_knowledge: ['天气', '时间', '几点', '位置'],
    local: ['美食', '餐厅', '景点', '酒店', '民宿', '旅游', '好吃', '推荐'],
    enterprise: ['公司', '企业', '财报', '融资', '估值', '上市', '业务', '战略', '销量', '产能'],
    general: ['什么', '怎么', '怎样', '谁', '哪些', '方法', '政策', '利率', '怎么算', '原理'],
  }
  return tokenMap[domain] || []
}
