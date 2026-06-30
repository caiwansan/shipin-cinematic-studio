/**
 * GEO Knowledge Service — Real API Implementation
 *
 * GET /api/v1/geo/knowledge/{projectId}
 */
import { ofetch } from 'ofetch'

export interface KnowledgeData {
  brandDescription: string
  coverage: number
  categories: string[]
  sources: Array<{
    name: string
    type: string
    freshness: string
  }>
  missingKnowledge: string[]
  freshness: {
    score: number
    lastUpdated: string
  }
  relationships: Array<{
    source: string
    target: string
    type: string
  }>
  statements: Array<{
    id: string
    content: string
    category: string
    status: 'verified' | 'pending' | 'outdated'
  }>
}

const API_BASE = '/api/v1/geo'

export async function fetchKnowledge(projectId: string): Promise<KnowledgeData> {
  return ofetch(`${API_BASE}/knowledge/${projectId}`)
}
