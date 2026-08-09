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
  aiSummary?: string | null
  aiSuggestions?: string[]
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
// Scans
// ==============================

/** 启动品牌扫描（返回 scanJobId） */
export async function startScan(projectId: string): Promise<ScanJobResult> {
  const res = await geoApi.post<{ success: boolean; data: ScanJobResult }>(
    `/projects/${projectId}/scan`,
    {}
  )
  return res.data
}

/** 获取项目最新扫描结果 */
export async function getLatestScan(projectId: string): Promise<ScanDetail | null> {
  try {
    const res = await geoApi.get<{ success: boolean; data: ScanDetail[] }>(
      `/projects/${projectId}/scans`
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
  const res = await geoApi.get<{ success: boolean; data: ScanDetail }>(
    `/projects/${projectId}/scans/${scanId}`
  )
  return res.data
}

/** 获取优化建议 */
export async function fetchOptimizeSuggestions(projectId: string, scanId: string): Promise<OptimizeSuggestion[]> {
  const res = await geoApi.post<{ success: boolean; data: OptimizeSuggestion[] }>(
    `/projects/${projectId}/scans/${scanId}/optimize`
  )
  return res.data
}

/** 标记优化建议已应用 */
export async function applyOptimization(projectId: string, scanId: string): Promise<boolean> {
  const res = await geoApi.post<{ success: boolean; data: any }>(
    `/projects/${projectId}/scans/${scanId}/apply`
  )
  return res.success
}
