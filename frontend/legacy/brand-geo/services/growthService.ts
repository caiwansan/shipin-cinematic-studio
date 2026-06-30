// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// Growth Service v3 — GEO Growth Engine
// Calls backend growth endpoints via GEOApiClient
// Base URL is /api/geo, so paths are relative (e.g. /growth/options)
// ============================================================

import { client } from '../clients/GEOApiClient'

// ── Types ──

export interface GrowthOption {
  type: string
  label: string
  effort: 'EASY' | 'MEDIUM' | 'HARD'
  impact: number
}

export interface ExecutionResult {
  optimizationType: string
  status: 'completed' | 'failed'
  contentId?: string
  scoreImprovement?: number
  error?: string
}

export interface ForecastPeriod {
  period: '7d' | '30d' | '90d'
  estimatedScore: number
  estimatedVisibility: string
  keyActions: string[]
}

export interface GrowthForecast {
  current: any
  forecast: ForecastPeriod[]
}

// ── API Calls ──

/**
 * GET /api/geo/growth/options
 * Returns available optimization types
 */
export async function fetchGrowthOptions(): Promise<GrowthOption[]> {
  const res = await client.get('/growth/options')
  return res.data?.data || []
}

/**
 * POST /api/geo/growth/execute
 * Execute an optimization task
 */
export async function executeGrowthTask(params: {
  projectId: string
  type: string
  brandName: string
}): Promise<ExecutionResult> {
  const res = await client.post('/growth/execute', params)
  return res.data?.data
}

/**
 * POST /api/geo/growth/generate
 * Generate content without executing optimization
 */
export async function generateContent(params: {
  projectId: string
  contentType: string
  brandName: string
  context?: Record<string, any>
}): Promise<any> {
  const res = await client.post('/growth/generate', params)
  return res.data?.data
}

/**
 * GET /api/geo/growth/forecast
 * Returns growth forecast
 */
export async function fetchGrowthForecast(projectId: string): Promise<GrowthForecast> {
  const res = await client.get(`/growth/forecast?projectId=${encodeURIComponent(projectId)}`)
  return res.data?.data
}
