/**
 * GEO Knowledge Service — Real API Implementation
 *
 * GET /api/v1/geo/knowledge/{projectId}
 *
 * API Returns: { success, data: { assets, coverage, categories, freshness, missingKnowledge, relationships } }
 * Mapped to: KnowledgeData (Product Language)
 */
import { geoApi } from './api'

export interface KnowledgeAssets {
  total: number
  entities: number
  claims: number
  evidences: number
  relations: number
  schemas: number
  faqs: number
  keywords: number
  knowledgeObjects: number
}

export interface KnowledgeDimensionCoverage {
  name: string
  covered: boolean
  count: number
}

export interface KnowledgeCoverage {
  percentage: number
  coveredDimensions: number
  totalDimensions: number
  dimensions: KnowledgeDimensionCoverage[]
}

export interface KnowledgeCategory {
  name: string
  count: number
  items: string[]
}

export interface KnowledgeFreshness {
  overall: number
  lastUpdated: string | null
  staleItems: number
  freshItems: number
}

export interface MissingKnowledgeItem {
  category: string
  suggestion: string
}

export interface KnowledgeRelationship {
  source: string
  target: string
  type: string
}

export interface KnowledgeData {
  assets: KnowledgeAssets
  coverage: KnowledgeCoverage
  categories: KnowledgeCategory[]
  freshness: KnowledgeFreshness
  missingKnowledge: MissingKnowledgeItem[]
  relationships: KnowledgeRelationship[]
  // Derived for backward compatibility
  brandDescription: string
  sources: Array<{
    name: string
    type: string
    freshness: string
  }>
  statements: Array<{
    id: string
    content: string
    category: string
    status: 'verified' | 'pending' | 'outdated'
  }>
}

export const DEFAULT_KNOWLEDGE_DATA: KnowledgeData = {
  assets: { total: 0, entities: 0, claims: 0, evidences: 0, relations: 0, schemas: 0, faqs: 0, keywords: 0, knowledgeObjects: 0 },
  coverage: { percentage: 0, coveredDimensions: 0, totalDimensions: 7, dimensions: [] },
  categories: [],
  freshness: { overall: 0, lastUpdated: null, staleItems: 0, freshItems: 0 },
  missingKnowledge: [{ category: 'brand-info', suggestion: '请先完成发现评估以获取知识数据' }],
  relationships: [],
  brandDescription: '暂无数据',
  sources: [],
  statements: [],
}

export async function fetchKnowledge(projectId: string): Promise<KnowledgeData> {
  let raw: { success: boolean; data: any }
  try {
    raw = await geoApi<{ success: boolean; data: any }>('knowledge', {
      params: { projectId },
    })
  } catch {
    return DEFAULT_KNOWLEDGE_DATA
  }
  const d = raw.data
  if (!d) return DEFAULT_KNOWLEDGE_DATA

  const assets = d.assets ?? { total: 0, entities: 0, claims: 0, evidences: 0, relations: 0, schemas: 0, faqs: 0, keywords: 0, knowledgeObjects: 0 }
  const coverage = d.coverage ?? { percentage: 0, coveredDimensions: 0, totalDimensions: 7, dimensions: [] }
  const categories = d.categories ?? []
  const freshness = d.freshness ?? { overall: 0, lastUpdated: null, staleItems: 0, freshItems: 0 }
  const missingKnowledge = d.missingKnowledge ?? []
  const relationships = d.relationships ?? []

  // Build brand description from assets summary
  const brandDescription = `Brand knowledge base with ${assets.total} total assets across ${coverage.coveredDimensions} of ${coverage.totalDimensions} dimensions.`

  // Build sources from categories
  const sources = categories.map((cat: any) => ({
    name: cat.name ?? 'Unknown Category',
    type: 'category',
    freshness: freshness.lastUpdated ? `Updated ${freshness.lastUpdated.split('T')[0]}` : 'Not updated',
  }))

  // Build statements from categories
  const statements = categories.flatMap((cat: any) =>
    (cat.items ?? []).map((item: string) => ({
      id: `${cat.name}-${item}`,
      content: item,
      category: cat.name,
      status: 'verified' as const,
    }))
  )

  return {
    assets,
    coverage,
    categories,
    freshness,
    missingKnowledge,
    relationships,
    // Derived for backward compatibility
    brandDescription,
    sources,
    statements,
  }
}
