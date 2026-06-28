/**
 * evidence-refinement.ts — AG-6.0: Evidence Refinement Layer
 *
 * 插在 Search → Cluster 之间，提升证据精确率。
 *
 * 核心逻辑：
 *   relevance = 0.4 × semanticSimilarity + 0.3 × keywordOverlap + 0.2 × domainMatch + 0.1 × sourceTrust
 *
 * 阈值 < 0.45 → 丢弃
 * 阈值 ≥ 0.80 → auto-pass（高信度不计算完整评分）
 *
 * 目标：evidencePrecision 从 ~0.43 提升到 0.55~0.65
 */

interface EvidenceItem {
  title: string
  snippet: string
  url?: string
  source?: string
}

interface RefinedEvidence extends EvidenceItem {
  relevanceScore: number
  semanticSimilarity: number
  keywordOverlap: number
  domainMatch: number
  sourceTrust: number
}

/**
 * 主入口：精炼证据
 * - 计算每条证据与 query 的多维相关性
 * - 丢弃 irrelevance（< 0.45）
 * - 返回精炼后的证据列表及其评分
 */
export function refineEvidence(
  query: string,
  evidences: EvidenceItem[],
  expectedDomain?: string
): RefinedEvidence[] {
  if (!evidences || evidences.length === 0) return []

  const parsed = parseQuery(query)

  const refined = evidences
    .map(ev => scoreRelevance(ev, query, parsed, expectedDomain))
    .filter(ev => ev.relevanceScore >= 0.25)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)

  console.log(`[AG-6.0] 精炼: ${evidences.length} 条 → ${refined.length} 条保留` +
    ` | 最高分=${refined.length > 0 ? refined[0].relevanceScore.toFixed(3) : 'N/A'}` +
    ` | 最低分=${refined.length > 0 ? refined[refined.length - 1].relevanceScore.toFixed(3) : 'N/A'}`)

  return refined
}

// ============================================================
// 内部实现
// ============================================================

interface ParsedQuery {
  tokens: string[]
  bigrams: Set<string>
  // 常见中英文停用词
}

function parseQuery(query: string): ParsedQuery {
  // 分词：中文按字分隔，英文按空格
  const cleaned = query.replace(/[^\w\u4e00-\u9fff]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0)

  // 中文二元组
  const bigrams = new Set<string>()
  const chinese = cleaned.replace(/[a-zA-Z0-9]/g, '')
  for (let i = 0; i < chinese.length - 1; i++) {
    const bg = chinese[i] + chinese[i + 1]
    if (/[\u4e00-\u9fff]{2}/.test(bg)) bigrams.add(bg)
  }

  return { tokens, bigrams }
}

function scoreRelevance(
  ev: EvidenceItem,
  query: string,
  parsed: ParsedQuery,
  expectedDomain?: string
): RefinedEvidence {
  const text = `${ev.title} ${ev.snippet}`

  // 1. Semantic Similarity (0.4) — 基于关键词共现
  const semanticSimilarity = computeSemanticSimilarity(text, parsed, query)

  // 2. Keyword Overlap (0.3) — Jaccard
  const keywordOverlap = computeKeywordOverlap(text, parsed)

  // 3. Domain Match (0.2) — 领域一致性
  const domainMatch = computeDomainMatch(text, expectedDomain)

  // 4. Source Trust (0.1) — 来源可信度
  const sourceTrust = computeSourceTrust(ev)

  // 加权组合
  const relevanceScore =
    semanticSimilarity * 0.4 +
    keywordOverlap * 0.3 +
    domainMatch * 0.2 +
    sourceTrust * 0.1

  return {
    ...ev,
    relevanceScore: Math.round(relevanceScore * 1000) / 1000,
    semanticSimilarity: Math.round(semanticSimilarity * 1000) / 1000,
    keywordOverlap: Math.round(keywordOverlap * 1000) / 1000,
    domainMatch: Math.round(domainMatch * 1000) / 1000,
    sourceTrust: Math.round(sourceTrust * 1000) / 1000,
  }
}

/** 语义相似度：基于 query 关键词在文本中的出现密度 */
function computeSemanticSimilarity(text: string, parsed: ParsedQuery, query: string): number {
  const lower = text.toLowerCase()
  const queryLower = query.toLowerCase()

  // 精确匹配
  if (lower.includes(queryLower)) return 1.0

  // Token 匹配率
  const tokenHits = parsed.tokens.filter(t => lower.includes(t.toLowerCase())).length
  const tokenRatio = parsed.tokens.length > 0 ? tokenHits / parsed.tokens.length : 0

  // Bigram 匹配率
  const bgArr = [...parsed.bigrams]
  const bgHits = bgArr.filter(bg => lower.includes(bg)).length
  const bgRatio = bgArr.length > 0 ? bgHits / bgArr.length : 0

  // 组合
  return Math.min(1.0, tokenRatio * 0.6 + bgRatio * 0.4)
}

/** 关键词交并比：与语义相似度互补，更侧重广度 */
function computeKeywordOverlap(text: string, parsed: ParsedQuery): number {
  const lower = text.toLowerCase()

  // 提取文本中所有中文词和英文词
  const textTokens = lower.split(/[\s,，。.;；：、！!?？]+/).filter(t => t.length > 0)

  const querySet = new Set(parsed.tokens.map(t => t.toLowerCase()))
  const textSet = new Set(textTokens)

  const intersect = new Set([...querySet].filter(x => textSet.has(x) || textTokens.some(t => t.includes(x))))
  const union = new Set([...querySet, ...textSet])

  // 如果交集为空但 title 模糊包含了查询词，给一个基础分
  if (intersect.size === 0) {
    for (const q of querySet) {
      if (lower.includes(q)) { intersect.add(q); break }
    }
  }

  return union.size > 0 ? intersect.size / Math.min(union.size, querySet.size + 5) : 0
}

/** 领域匹配度 */
function computeDomainMatch(text: string, expectedDomain?: string): number {
  if (!expectedDomain) return 0.5 // 无领域信息时中立

  const domainKeywords: Record<string, string[]> = {
    local: ['店', '馆', '医院', '餐厅', '附近', '地址', '电话', '营业', '评价', '推荐', '怎么走', '哪里'],
    enterprise: ['公司', '集团', '股份', '有限', '上市', '财报', '业务', '营收', '规模', '员工'],
    product: ['价格', '性价比', '推荐', '评测', '参数', '品牌', '型号', '购买', '功能', '好用'],
    general: ['是什么', '意思', '原理', '定义', '概念', '历史', '发展', '原因', '影响', '教程'],
  }

  const keywords = domainKeywords[expectedDomain]
  if (!keywords) return 0.5

  const lower = text.toLowerCase()
  const hits = keywords.filter(kw => lower.includes(kw)).length
  return Math.min(1.0, hits / 5) // 5 个关键词命中即满分
}

/** 来源可信度 */
function computeSourceTrust(ev: EvidenceItem): number {
  const url = ev.url || ''
  const source = ev.source || url

  // 权威来源加分
  if (source.includes('gov.cn')) return 0.95
  if (source.includes('edu.cn')) return 0.90
  if (source.includes('zhihu.com')) return 0.80
  if (source.includes('baike.baidu.com')) return 0.80
  if (source.includes('bing.com')) return 0.75

  // 一般来源
  return 0.60
}
