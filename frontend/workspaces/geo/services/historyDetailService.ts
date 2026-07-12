/**
 * GEO History Detail Service — Timeline + Stats API
 *
 * GET /api/geo/history?projectId=xxx&limit=50&offset=0&type=all
 * GET /api/geo/history/stats?projectId=xxx
 *
 * History timeline from aggregated data sources.
 */
import { geoApi } from './api'

export interface HistoryEvent {
  id: string
  type: string
  description: string
  timestamp: string
  projectId: string
  metadata?: Record<string, unknown>
}

export interface HistoryStats {
  scans: number
  claims: number
  knowledge: number
  evidence: number
}

export interface HistoryResponse {
  success: boolean
  data: HistoryEvent[]
  total: number
  offset: number
  limit: number
}

export interface HistoryStatsResponse {
  success: boolean
  data: HistoryStats
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  website_scanned: { label: '网站扫描', icon: '🌐' },
  claim_generated: { label: 'Claim 生成', icon: '📝' },
  knowledge_updated: { label: 'Knowledge 更新', icon: '🧠' },
  execution_completed: { label: '执行完成', icon: '✅' },
  execution_started: { label: '执行开始', icon: '🔄' },
}

const TYPE_CATEGORIES: Record<string, string> = {
  website_scanned: 'scan',
  claim_generated: 'claim',
  knowledge_updated: 'knowledge',
  execution_completed: 'execution',
  execution_started: 'execution',
}

export function getEventLabel(type: string): string {
  return TYPE_LABELS[type]?.label ?? type
}

export function getEventIcon(type: string): string {
  return TYPE_LABELS[type]?.icon ?? '📌'
}

export function getEventCategory(type: string): string {
  return TYPE_CATEGORIES[type] ?? 'other'
}

export async function fetchHistoryEvents(
  projectId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ projectId })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))
  if (options?.type && options.type !== 'all') params.set('type', options.type)

  return geoApi<HistoryResponse>(`history?${params.toString()}`)
}

export async function fetchHistoryStats(projectId: string): Promise<HistoryStats> {
  const raw = await geoApi<HistoryStatsResponse>(`history/stats?projectId=${encodeURIComponent(projectId)}`)
  return raw.data
}
