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

/** 触发扫描 */
export async function triggerScan(projectId: string): Promise<{ scanId: string; status: string; estimatedSeconds: number }> {
  const raw = await geoApi<{ success: boolean; data: { scanId: string; status: string; estimatedSeconds: number } }>(
    `/projects/${projectId}/scan`,
    { method: 'POST' }
  )
  return raw.data
}

/** 获取扫描结果 */
export async function fetchScanResult(projectId: string, scanId: string): Promise<ScanResult> {
  const raw = await geoApi<{ success: boolean; data: any }>(`/projects/${projectId}/scans/${scanId}`)
  const data = raw.data

  // 后端返回的 dimensions 是 { visibility: {score, explanation}, ... } 对象格式
  // 前端需要 Array<{id, label, score, maxScore, description}> 数组格式
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

/** 解析扫描历史列表（从项目详情中获取） */
export async function fetchScanHistory(projectId: string): Promise<ScanHistoryItem[]> {
  const project = await fetchProject(projectId)
  // If the project has a scans list embedded, use it
  // Otherwise, scan history will be managed by the store
  return []
}
