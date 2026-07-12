/**
 * Shared helper: parseProviderResult
 *
 * 将 SOL 提取后的对象转换为 ProviderResult 所需的 Partial<ProviderResult>。
 * 所有 Adapter 共享此逻辑，消除重复的字段验证代码。
 */

export interface ParsedProviderOutput {
  visibility?: string
  knowledgeQuality?: number
  confidence?: number
  evidenceCount?: number
  summary?: string
  recommendations?: string[]
  __stage?: string
  __raw?: string
}

export function parseProviderResult(parsed: ParsedProviderOutput): {
  visibility: string
  knowledgeQuality: number
  confidence: number
  evidenceCount: number
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'N/A'
  summary?: string
  recommendations: string[]
} {
  const validVisibilities = ['visible', 'partial', 'missing', 'unknown']
  const visibility = validVisibilities.includes(parsed.visibility) ? parsed.visibility : 'unknown'

  const knowledgeQuality = typeof parsed.knowledgeQuality === 'number'
    ? Math.max(0, Math.min(100, Math.round(parsed.knowledgeQuality)))
    : 0
  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
    : 0
  const evidenceCount = typeof parsed.evidenceCount === 'number'
    ? Math.max(0, Math.round(parsed.evidenceCount))
    : 0

  let evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'N/A' = 'N/A'
  if (evidenceCount >= 5) evidenceLevel = 'A'
  else if (evidenceCount >= 3) evidenceLevel = 'B'
  else if (evidenceCount >= 2) evidenceLevel = 'C'
  else if (evidenceCount >= 1) evidenceLevel = 'D'

  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.slice(0, 5).map(String)
    : []

  return {
    visibility,
    knowledgeQuality,
    confidence,
    evidenceCount,
    evidenceLevel,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    recommendations,
  }
}
