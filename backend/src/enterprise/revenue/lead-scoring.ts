/**
 * Phase 4: Lead Scoring Engine — Evidence-Based
 * CTO修正3: 不是 Interaction数量+公式=客户价值
 * 链条: Interaction → Lead Evidence → Intelligence → Recommendation
 */
export interface Interaction {
  type: string       // like | comment | share | message | view | download
  platform: string
  content?: string
  timestamp: Date
}

export interface LeadEvidence {
  type: string       // pricing_question | case_download | repeat_visit | direct_message | keyword_hit
  evidence: string   // 可解释证据
  weight: number     // 0-100
  timestamp: Date
}

export interface LeadScoreResult {
  intentScore: number
  temperature: 'cold' | 'warm' | 'hot' | 'customer'
  purchaseProb: number
  evidence: LeadEvidence[]
  nextAction: string
  estimatedValue: number
  valueSource: string
}

// 关键词库 — 采购意向信号
const PURCHASE_KEYWORDS = ['采购', '询价', '报价', '价格', '多少钱', '合作', '招标', '需求', '方案', '演示', '试用', '采购', '签约']
const CASE_KEYWORDS = ['案例', '客户', '效果', '转化', '增长', '成功']
const COMPETITION_KEYWORDS = ['对比', '比较', '区别', '优势', '竞品']

// 行业估值映射
const INDUSTRY_VALUE: Record<string, number> = {
  '物流': 50000, '新能源': 80000, '制造': 60000,
  '科技': 40000, '教育': 30000, '金融': 70000,
  '医疗': 60000, '零售': 35000, '其他': 35000
}

/**
 * 从互动中提取证据链
 */
export function extractEvidence(interactions: Interaction[]): LeadEvidence[] {
  const evidence: LeadEvidence[] = []

  for (const ix of interactions) {
    const content = ix.content || ''
    
    // 价格询问 = 强信号
    if (PURCHASE_KEYWORDS.some(k => content.includes(k))) {
      evidence.push({
        type: 'pricing_question',
        evidence: `互动内容包含采购信号: "${content.slice(0, 50)}"`,
        weight: 20,
        timestamp: ix.timestamp
      })
    }
    
    // 案例兴趣 = 中信号  
    if (CASE_KEYWORDS.some(k => content.includes(k))) {
      evidence.push({
        type: 'case_interest',
        evidence: `对案例/效果表达兴趣: "${content.slice(0, 50)}"`,
        weight: 15,
        timestamp: ix.timestamp
      })
    }
    
    // 对比意向 = 强信号
    if (COMPETITION_KEYWORDS.some(k => content.includes(k))) {
      evidence.push({
        type: 'competition_comparison',
        evidence: `正在对比竞品: "${content.slice(0, 50)}"`,
        weight: 18,
        timestamp: ix.timestamp
      })
    }
    
    // 直接消息 = 强信号
    if (ix.type === 'message' && content.length > 10) {
      evidence.push({
        type: 'direct_message',
        evidence: `主动留言(${content.length}字): "${content.slice(0, 50)}"`,
        weight: 25,
        timestamp: ix.timestamp
      })
    }
    
    // 下载行为 = 强信号
    if (ix.type === 'download' || content.includes('下载')) {
      evidence.push({
        type: 'content_download',
        evidence: `下载了资料`,
        weight: 22,
        timestamp: ix.timestamp
      })
    }
  }
  
  return evidence
}

/**
 * 计算购买意向分数 (0-100) — 纯证据驱动
 */
export function calcIntentScore(evidence: LeadEvidence[], interactionCount: number): number {
  if (evidence.length === 0 && interactionCount === 0) return 0
  
  // 证据分: 所有证据权重加和, 最高60分
  const evidenceScore = Math.min(evidence.reduce((s, e) => s + e.weight, 0), 60)
  
  // 互动频率分: 每次互动+3分, 最高25分
  const frequencyScore = Math.min(interactionCount * 3, 25)
  
  // 最近互动加分: 如果有3天内的证据 +15分
  const recentEvidence = evidence.filter(e => {
    const daysAgo = (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 3
  })
  const recencyScore = recentEvidence.length > 0 ? 15 : 0
  
  return Math.min(evidenceScore + frequencyScore + recencyScore, 100)
}

/**
 * 温度分级
 */
export function getTemperature(score: number): 'cold' | 'warm' | 'hot' | 'customer' {
  if (score >= 80) return 'customer'
  if (score >= 60) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

/**
 * 成交概率 — 基于证据而非随机
 */
export function calcPurchaseProb(intentScore: number, evidenceCount: number): number {
  // 基础分 = intentScore 的 70%
  const base = intentScore * 0.7
  // 证据加成: 每条有效证据+5分, 最高15分
  const evidenceBonus = Math.min(evidenceCount * 5, 15)
  return Math.min(Math.round(base + evidenceBonus), 95)
}

/**
 * 预估成交金额
 */
export function estimateValue(industry: string, companySize?: string): { value: number; source: string } {
  const baseValue = INDUSTRY_VALUE[industry] || INDUSTRY_VALUE['其他']
  
  // 规模修正
  let multiplier = 1.0
  if (companySize === '200+') multiplier = 1.5
  else if (companySize === '50-200') multiplier = 1.2
  else if (companySize === '1-50') multiplier = 0.8
  
  return {
    value: Math.round(baseValue * multiplier),
    source: 'industry_template'
  }
}

/**
 * 生成跟进建议
 */
export function generateNextAction(score: number, evidence: LeadEvidence[]): string {
  if (score >= 80) return '优先跟进：安排演示会议，发送定制方案'
  if (score >= 60) return '发送行业案例+报价资料，建立深度信任'
  
  // 基于最重证据类型推荐
  const topEvidence = evidence.sort((a, b) => b.weight - a.weight)[0]
  if (topEvidence?.type === 'pricing_question') return '发送详细报价单+套餐对比表'
  if (topEvidence?.type === 'case_interest') return '发送同行业成功案例+效果数据'
  if (topEvidence?.type === 'direct_message') return '回复留言，引导深入沟通'
  
  return '持续互动，培养认知，定期发送有价值内容'
}

/**
 * Lead Intelligence 完整评估
 */
export function evaluateLead(
  interactions: Interaction[],
  industry: string = '其他',
  companySize?: string
): LeadScoreResult {
  const evidence = extractEvidence(interactions)
  const intentScore = calcIntentScore(evidence, interactions.length)
  const temperature = getTemperature(intentScore)
  const purchaseProb = calcPurchaseProb(intentScore, evidence.length)
  const { value, source: valueSource } = estimateValue(industry, companySize)
  const nextAction = generateNextAction(intentScore, evidence)
  
  return {
    intentScore,
    temperature,
    purchaseProb,
    evidence,
    nextAction,
    estimatedValue: value,
    valueSource
  }
}
