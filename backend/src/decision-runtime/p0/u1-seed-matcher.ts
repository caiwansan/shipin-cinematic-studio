/**
 * u1-seed-matcher.ts — Phase U-1 Seed Similarity Matching Engine
 *
 * ============================================================
 * 可解释、可控、可调阈值的确定性语义匹配算法。
 *
 * 不使用 embedding / LLM / 任何非确定性技术。
 * 六维评分：TokenOverlap + KeywordMatch + AliasMatch + DomainMatch + EditSimilarity + StructureMatch
 *
 * 宪法：
 *   ❌ 不引入 embedding
 *   ❌ 不引入 AI/LLM
 *   ✅ 纯确定性函数（相同输入→相同输出）
 *   ✅ 可冻结（适配 B-4.6）
 *   ✅ 每个子维度的权重可独立调整
 * ============================================================
 */

// ============================================================
// 1. 标准化 seed 数据结构
// ============================================================

export interface SemanticSeed {
  id: string
  domain: string
  queryPatterns: string[]
  keywords: string[]
  aliases?: string[]
  weight?: number
  structureHints?: string[]
}

// ============================================================
// 2. Query 预处理
// ============================================================

export function normalize(query: string): string[] {
  const lower = query.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, '')
  const tokens: string[] = []

  // 提取连续中文片段
  const chineseSegments = lower.match(/[\u4e00-\u9fa5]+/g) || []
  for (const seg of chineseSegments) {
    // 整段作为 token
    tokens.push(seg)
    // 2-gram
    for (let i = 0; i < seg.length - 1; i++) {
      tokens.push(seg.slice(i, i + 2))
    }
    // 3-gram（对于中长词，保留更多上下文）
    if (seg.length >= 3) {
      tokens.push(seg.slice(0, 2))
      tokens.push(seg.slice(0, 3))
    }
  }

  // 英文/数字部分按空白拆分
  const nonChinese = lower.replace(/[\u4e00-\u9fa5]+/g, ' ').trim()
  if (nonChinese) {
    tokens.push(...nonChinese.split(/\s+/).filter(Boolean))
  }

  return tokens
}

// ============================================================
// 3. 常量定义
// ============================================================

// 领域→领域词映射（domainMatch 使用）
const DOMAIN_TOKEN_MAP: Record<string, string[]> = {
  local: ['餐厅', '酒店', '景点', '美食', '旅游', '门票', '住宿', '民宿', '好吃', '必吃', '小吃', '菜馆', '饭店', '附近', '哪里', '怎么去', '地址', '电话', '哪家', '驾校', '幼儿园', '律所', '诊所', '医院'],
  consumer_electronics: ['手机', '电脑', 'iphone', '华为', '笔记本', '平板', '相机', '耳机', '音响', '手表', '手环', '充电', '屏幕', '内存', 'cpu', 'gpu', '显卡', '硬盘', '键盘', '鼠标', '智能'],
  lifestyle: ['书', '小说', '读', '作者', '电影', '视频', '运动', '健身', '跑步', '减肥', '吃', '饮食', '旅行', '旅游', '音乐', '游戏', '爱好', '推荐', '建议'],
  business_intel: ['公司', '企业', '靠谱吗', '背景', '融资', '上市', '估值', '行业', '市场', '产品', '团队', '技术', '客户', '营收', '利润', '旗下', '销量', '交付量', '财报'],
  general_knowledge: ['天气', '时间', '日期', '地点', '位置', '哪里', '什么时候', '几点了', '现在', '今天', '明天', '昨天', '几点'],
  enterprise: ['公司', '企业', '财报', '融资', '估值', '上市', '营收', '业务', '战略', '销量', '产能', '市场份额', '品牌', '行业'],
  general: ['什么是', '什么意思', '是什么意思', '怎么学', '怎么', '怎么样', '如何', '学习', '方法', '政策', '利率', '怎么算', '原理', '谁', '是谁', '最新数据'],
}

// 细分 domain → 粗粒度 domain 映射（new P0 seed 使用细分 domain，DOMAIN_TOKEN_MAP 用粗粒度）
const DOMAIN_PARENT_MAP: Record<string, string> = {
  local_food_recommendation: 'local',
  local_travel_attraction: 'local',
  local_travel_accommodation: 'local',
  local_service_recommendation: 'local',
  // P1.1 enterprise/general domain 本身就是粗粒度
}

// 默认权重
// 默认权重（针对中文语境校准——domain 匹配是中文最强信号）
const DEFAULT_WEIGHTS = {
  tokenOverlap: 0.20,
  keywordMatch: 0.15,
  aliasMatch: 0.15,
  domainMatch: 0.35,
  editSimilarity: 0.15,
}

// 阈值（针对中文语义匹配校准——中文 query 的 domainMatch 能贡献 0.35，
// 其他组件自然贡献约 0.05-0.15，总分布在 0.42-0.65 之间）
export const THRESHOLDS = {
  strong: 0.60,      // 强匹配 → 直接 P-0 主路径
  acceptable: 0.42,  // 可接受 → 进入 shadow execution
  weak: 0.25,        // 弱匹配 → 低置信度
}

// ============================================================
// 4. 子匹配模块
// ============================================================

// 4.1 Token Overlap（子串匹配——query 的 ngram 中出现在 keyword 里的比例）
// 对中文更友好，不需要精确 token 对齐
export function tokenOverlap(qTokens: string[], seedTokens: string[]): number {
  if (qTokens.length === 0 || seedTokens.length === 0) return 0
  const combinedSeed = seedTokens.join(' ')
  let matchCount = 0
  for (const qt of qTokens) {
    if (qt.length >= 2 && combinedSeed.includes(qt)) {
      matchCount++
    }
  }
  return matchCount / qTokens.length
}

// 4.2 Keyword Match（强化信号——使用 includes + queryPatterns 前缀匹配）
export function keywordMatch(qTokens: string[], keywords: string[], queryPatterns: string[] = []): number {
  const fullQuery = qTokens.join('')
  let score = 0

  // 先过 queryPatterns——如果 query 包含任一 queryPattern，直接给满分
  for (const qp of queryPatterns) {
    if (fullQuery.includes(qp)) {
      return 1.0
    }
  }

  // 再用 keywords 做子串匹配
  for (const k of keywords) {
    if (fullQuery.includes(k)) score += 1
  }
  return score / Math.max(keywords.length, 1)
}

// 4.3 Alias Match（语义弱等价）
export function aliasMatch(query: string, aliases: string[] = []): number {
  return aliases.some(a => query.includes(a)) ? 1 : 0
}

// 4.4 Domain Match（强约束）
export function domainMatch(query: string, domain: string): number {
  // 细分 domain → 粗粒度 domain 归一化
  const normalizedDomain = DOMAIN_PARENT_MAP[domain] || domain
  const tokens = DOMAIN_TOKEN_MAP[normalizedDomain] || []
  return tokens.some(t => query.includes(t)) ? 1 : 0
}

// 4.5 Pattern Edit Similarity（轻编辑距离）
export function editSimilarity(query: string, patterns: string[]): number {
  let best = 0
  for (const p of patterns) {
    const dist = levenshtein(query, p)
    const maxLen = Math.max(query.length, p.length)
    const sim = 1 - (maxLen === 0 ? 0 : dist / maxLen)
    if (sim > best) best = sim
  }
  return best
}

// Levenshtein 距离
function levenshtein(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length
  const matrix: number[][] = []

  for (let i = 0; i <= aLen; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= bLen; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[aLen][bLen]
}

// 4.6 Structure Hint Match（可选增强）
export function structureMatch(query: string, hints: string[] = []): number {
  if (hints.length === 0) return 0
  // compare: compare/对比/哪个好
  if (hints.includes('compare')) {
    if (query.includes('对比') || query.includes('哪个好') || query.includes('vs') || query.includes('区别')) return 1
  }
  // review: 怎么样/评价/口碑
  if (hints.includes('review')) {
    if (query.includes('怎么样') || query.includes('评价') || query.includes('口碑') || query.includes('好不好')) return 1
  }
  // recommend: 推荐/什么好
  if (hints.includes('recommend')) {
    if (query.includes('推荐') || query.includes('什么好') || query.includes('哪个好')) return 1
  }
  return 0
}

// ============================================================
// 5. 多维评分函数
// ============================================================

export type ScoreWeights = Partial<typeof DEFAULT_WEIGHTS>

export function matchSeed(
  query: string,
  seed: SemanticSeed,
  forbiddenPatterns: string[] = [],  // 禁止域检查
  weights: ScoreWeights = {},
): { seedId: string; score: number; components: Record<string, number>; matched: boolean } {
  const lowerQuery = query.toLowerCase()
  const qTokens = normalize(query)
  const w = { ...DEFAULT_WEIGHTS, ...weights }

  // 检查禁止域——匹配则直接返回 0
  for (const fp of forbiddenPatterns) {
    if (lowerQuery.includes(fp)) {
      return {
        seedId: seed.id,
        score: 0,
        components: { tokenOverlap: 0, keywordMatch: 0, aliasMatch: 0, domainMatch: 0, editSimilarity: 0 },
        matched: false,
      }
    }
  }

  const tokenScore = tokenOverlap(qTokens, seed.keywords)
  const keywordScore = keywordMatch(qTokens, seed.keywords, seed.queryPatterns)
  const aliasScore = aliasMatch(query, seed.aliases)
  const domainScore = domainMatch(query, seed.domain)
  const editScore = editSimilarity(query, seed.queryPatterns)
  const structureScore = structureMatch(query, seed.structureHints)

  const totalScore =
    w.tokenOverlap * tokenScore +
    w.keywordMatch * keywordScore +
    w.aliasMatch * aliasScore +
    w.domainMatch * domainScore +
    w.editSimilarity * editScore

  return {
    seedId: seed.id,
    score: Math.round(totalScore * 1000) / 1000,
    components: {
      tokenOverlap: tokenScore,
      keywordMatch: keywordScore,
      aliasMatch: aliasScore,
      domainMatch: domainScore,
      editSimilarity: editScore,
    },
    matched: totalScore >= THRESHOLDS.acceptable,
  }
}

// ============================================================
// 6. Top-K 匹配（核心 runtime）
// ============================================================

export interface MatchResult {
  bestSeed: string | null
  bestScore: number
  bestDomain: string | null
  matchLevel: 'strong' | 'acceptable' | 'weak' | 'none'
  degraded: boolean
  candidates: Array<{ seedId: string; score: number }>
  topSeedComponents: Record<string, number> | null
  topSeedId: string | null
}

export function findBestSeed(
  query: string,
  seeds: SemanticSeed[],
  /** optional: seedId → forbiddenPatterns map */
  forbiddenMap?: Record<string, string[]>,
  weights?: ScoreWeights,
): MatchResult {
  const results = seeds
    .map(seed => matchSeed(query, seed, forbiddenMap?.[seed.id] ?? [], weights))
    .sort((a, b) => b.score - a.score)

  const best = results[0]
  const bestSeedId = best?.matched ? best.seedId : null
  const bestScore = best?.score || 0

  let matchLevel: MatchResult['matchLevel'] = 'none'
  if (best && best.score >= THRESHOLDS.strong) matchLevel = 'strong'
  else if (best && best.score >= THRESHOLDS.acceptable) matchLevel = 'acceptable'
  else if (best && best.score >= THRESHOLDS.weak) matchLevel = 'weak'

  // 找到最佳 seed 的 domain
  const bestSeed = seeds.find(s => s.id === bestSeedId)

  return {
    bestSeed: bestSeedId,
    bestScore,
    bestDomain: bestSeed?.domain ?? null,
    matchLevel,
    degraded: !(best?.matched && best.score >= THRESHOLDS.acceptable),
    candidates: results.slice(0, 3).map(r => ({
      seedId: r.seedId,
      score: r.score,
    })),
    // 最高分 seed 的组件详情
    topSeedComponents: best?.components ?? null,
    topSeedId: best?.seedId ?? null,
  }
}

// ============================================================
// 7. 工具
// ============================================================

/** 从 U0Seed 映射到 SemanticSeed */
import { U0Seed } from './u0-seed-schema.js'

export function convertU0Seed(s: U0Seed): SemanticSeed {
  return {
    id: s.id,
    domain: s.domain,
    queryPatterns: s.queryPatterns,
    keywords: extractAtomicKeywords(s),
    aliases: s.tags,
    weight: s.confidenceRule.fullConfidence,
    structureHints: extractStructureHint(s.queryPatterns),
  }
}

/**
 * 从 seed 提取原子关键词（而非 queryPatterns 整句）
 * 规则：
 *   - 去掉停用词（怎么样、如何、怎么、的是、有什么等）
 *   - 保留带领域标识的原子词
 */
function extractAtomicKeywords(seed: U0Seed): string[] {
  const stopwords = ['怎么样', '如何', '怎么', '的是', '有什么', '什么', '哪个', '哪些', '推荐', '评价', '好吗', '哪里', '去哪', '要不要', '好不']
  const patternWords: string[] = []

  for (const p of seed.queryPatterns) {
    // 拆解 2-中文字符片段
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 2; j <= Math.min(i + 4, p.length); j++) {
        const sub = p.slice(i, j)
        if (/[\u4e00-\u9fa5]/.test(sub) && !stopwords.includes(sub)) {
          patternWords.push(sub)
        }
      }
    }
  }

  // 去重 + 优先保留 domain 相关词
  const unique = [...new Set(patternWords)]

  // 额外注入领域标签词（权重敏感的优先放在前面）
  const domainTags: Record<string, string[]> = {
    consumer_electronics: ['手机', '电脑', '华为', '苹果', '电子', '数码', '产品', '耳机', '降噪', '音响', '笔记本', '平板', '相机'],
    lifestyle: ['生活', '书籍', '读书', '书', '阅读', '小说', '电影', '影片', '运动', '健身', '跑步', '锻炼', '饮食', '吃', '健康', '娱乐', '音乐', '游戏', '旅游'],
    business_intel: ['公司', '企业', '商业', '行业', '产品', '市场', '融资', '估值', '创业'],
    general_knowledge: ['天气', '下雨', '温度', '时间', '几点', '位置', '在哪里', '常识', '日期'],
    local: ['美食', '餐厅', '景点', '门票', '酒店', '住宿', '民宿', '推荐', '附近', '哪家', '哪里', '旅游', '好吃', '好玩的', '攻略', '地方', '排行榜'],
    enterprise: ['公司', '企业', '财报', '融资', '估值', '上市', '营收', '业务', '销量', '产能', '市场份额', '行业', '品牌', '战略'],
    general: ['什么', '怎么', '怎样', '如何', '谁', '哪些', '学习', '方法', '政策', '利率', '怎么算', '原理', '技术', '介绍'],
  }

  // 细分 domain → 粗粒度映射（与 DOMAIN_PARENT_MAP 同步）
  const parentDomain = DOMAIN_PARENT_MAP[seed.domain] || seed.domain

  return [...new Set([...unique, ...(domainTags[parentDomain] || [])])]
}

function extractStructureHint(patterns: string[]): string[] {
  const hints: string[] = []
  for (const p of patterns) {
    if (/对比|区别|哪个好|vs/i.test(p)) hints.push('compare')
    if (/怎么样|评价|口碑|好不好/i.test(p)) hints.push('review')
    if (/推荐|什么好|值得/i.test(p)) hints.push('recommend')
  }
  return [...new Set(hints)]
}

/** 批量转换 */
export function convertAllU0Seeds(seeds: U0Seed[]): SemanticSeed[] {
  return seeds.map(convertU0Seed)
}
