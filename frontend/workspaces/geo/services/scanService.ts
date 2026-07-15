/**
 * GEO Scan Service — API Layer for Brand Scanning
 *
 * All project/scan API calls.
 * Endpoints:
 *   GET    /projects
 *   POST   /projects
 *   GET    /projects/:id
 *   POST   /projects/:id/scan
 *   GET    /projects/:id/scans/:scanId
 *   POST   /projects/:id/scans/:scanId/optimize
 *   POST   /projects/:id/scans/:scanId/apply
 */
import { geoApi } from './api'

export interface ProjectItem {
  id: string
  name: string
  website: string
  industry?: string
  keywords?: string
  status: string
  overallScore?: number
  lastScanAt?: string
  createdAt: string
  updatedAt: string
}

export interface ScanResult {
  scanId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  estimatedSeconds?: number
  overallScore: number
  dimensions: Array<{
    id: string
    label: string
    score: number
    maxScore: number
    description: string
  }>
  summary: string
  startedAt?: string
  completedAt?: string
}

export interface OptimizeSuggestion {
  id: string
  dimensionId: string
  title: string
  description: string
  expectedImpact: number
  applied: boolean
}

export interface CreateProjectInput {
  name: string
  website: string
  industry?: string
  keywords?: string
}

export interface ScanHistoryItem {
  scanId: string
  status: string
  overallScore?: number
  startedAt: string
  completedAt?: string
  estimatedSeconds?: number
}

// ═══════════════════════════════════════
// Phase 2 — New Runtime scan types
// ═══════════════════════════════════════

export interface ScanJobResult {
  scanJobId: string
  scanId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  overallScore?: number
  error?: string
}

export interface ScanDetail {
  scanJobId: string
  scanId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  overallScore?: number
  entityName?: string
  summary?: string
  error?: string
  createdAt?: string
  updatedAt?: string
  report?: any
}

export type ScanStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'

// ==============================
// Projects
// ==============================

/** 获取所有品牌项目 */
export async function fetchProjects(): Promise<ProjectItem[]> {
  const raw = await geoApi<{ success: boolean; data: any[] }>('/projects')
  // 后端返回 latestScan 嵌套对象，拍平到顶层
  return (raw.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    website: p.website || '',
    industry: p.industry || '',
    keywords: typeof p.keywords === 'string' ? p.keywords : Array.isArray(p.keywords) ? p.keywords.join(', ') : '',
    status: p.status || 'active',
    overallScore: p.latestScan?.overallScore ?? undefined,
    lastScanAt: p.latestScan?.scanFinishedAt || undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
}

/** 获取单个品牌项目 */
export async function fetchProject(id: string): Promise<ProjectItem> {
  const raw = await geoApi<{ success: boolean; data: ProjectItem }>(`/projects/${id}`)
  return raw.data
}

/** 创建品牌项目 */
export async function createProject(input: CreateProjectInput): Promise<ProjectItem> {
  const raw = await geoApi<{ success: boolean; data: ProjectItem }>('/projects', {
    method: 'POST',
    body: input,
  })
  return raw.data
}

// ==============================
// Scans (old)
// ==============================

/** 触发扫描 */
export async function triggerScan(projectId: string): Promise<{ scanId: string; status: string; estimatedSeconds: number }> {
  const raw = await geoApi<{ success: boolean; data: { scanId: string; status: string; estimatedSeconds: number } }>(
    `/projects/${projectId}/scan`,
    { method: 'POST', body: {} }
  )
  return raw.data
}

/** 获取扫描结果 */
export async function fetchScanResult(projectId: string, scanId: string): Promise<ScanResult> {
  const raw = await geoApi<{ success: boolean; data: any }>(`/projects/${projectId}/scans/${scanId}`)
  const data = raw.data

  const dimMap: Record<string, { label: string; maxScore: number }> = {
    visibility: { label: '可见度', maxScore: 100 },
    accuracy: { label: '准确性', maxScore: 100 },
    consistency: { label: '一致性', maxScore: 100 },
    recommendation: { label: '推荐意愿', maxScore: 100 },
  }

  const dimensions: ScanResult['dimensions'] = Object.entries(data.dimensions || {}).map(([key, val]: [string, any]) => ({
    id: key,
    label: dimMap[key]?.label || key,
    score: val.score || 0,
    maxScore: dimMap[key]?.maxScore || 100,
    description: val.explanation || '',
  }))

  return {
    scanId: data.scanId || scanId,
    status: data.status || 'completed',
    overallScore: data.overallScore || 0,
    dimensions,
    summary: data.errorMessage || `综合评分 ${data.overallScore || 0}/100`,
    startedAt: data.scanStartedAt,
    completedAt: data.scanFinishedAt,
  }
}

/** 获取优化建议 */
export async function fetchOptimizeSuggestions(projectId: string, scanId: string): Promise<OptimizeSuggestion[]> {
  const raw = await geoApi<{ success: boolean; data: OptimizeSuggestion[] }>(
    `/projects/${projectId}/scans/${scanId}/optimize`,
    { method: 'POST' }
  )
  return raw.data
}

/** 标记优化建议已应用 */
export async function applyOptimization(projectId: string, scanId: string): Promise<boolean> {
  const raw = await geoApi<{ success: boolean; data: any }>(
    `/projects/${projectId}/scans/${scanId}/apply`,
    { method: 'POST' }
  )
  return raw.success
}

/** 解析扫描历史列表 */
export async function fetchScanHistory(projectId: string): Promise<ScanHistoryItem[]> {
  const project = await fetchProject(projectId)
  return []
}

// ═══════════════════════════════════════
// Phase 2 — New Runtime scan functions
// ═══════════════════════════════════════

/** 启动品牌扫描（Phase 2 — 返回 scanJobId） */
export async function startScan(projectId: string): Promise<ScanJobResult> {
  const res = await geoApi<{ success: boolean; data: ScanJobResult }>(
    `/projects/${projectId}/scan`,
    { method: 'POST' }
  )
  return res.data
}

/** 获取项目最新扫描结果 */
export async function getLatestScan(projectId: string): Promise<ScanDetail | null> {
  try {
    const res = await geoApi<{ success: boolean; data: ScanDetail[] }>(
      `/projects/${projectId}/scans`,
      { method: 'GET' }
    )
    const scans = res.data || []
    if (scans.length === 0) return null
    const latest = scans[0]
    return {
      scanJobId: latest.scanJobId || latest.scanId,
      scanId: latest.scanId,
      status: latest.status as any,
      overallScore: latest.overallScore,
      entityName: latest.entityName,
      summary: latest.summary,
      error: latest.error,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
      report: latest.report,
    }
  } catch {
    return null
  }
}

/** 获取指定扫描任务状态 */
export async function getScanStatus(projectId: string, scanId: string): Promise<ScanDetail> {
  const res = await geoApi<{ success: boolean; data: ScanDetail }>(
    `/projects/${projectId}/scans/${scanId}`,
    { method: 'GET' }
  )
  return res.data
}
