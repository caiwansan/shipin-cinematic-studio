/**
 * BrandHealth Service — 品牌健康报告 API 服务
 *
 * 调用后端 GET /api/geo/projects/:id/brand-health
 * 返回 BrandHealthReport（产品领域模型，无需前端再映射）
 */
import { geoApi } from './api'
import type { BrandHealthReport } from '../types/brand-health'

export interface BrandHealthApiResponse {
  success: boolean
  data: BrandHealthReport
}

/**
 * 获取品牌健康报告
 * @param projectId 项目 ID
 * @returns BrandHealthReport 完整的品牌健康报告
 */
export async function fetchBrandHealth(projectId: string): Promise<BrandHealthReport> {
  const raw = await geoApi<BrandHealthApiResponse>(`projects/${projectId}/brand-health`)
  return raw.data
}

/**
 * 获取品牌健康概览（简版，用于卡片展示）
 * @param projectId 项目 ID
 */
export async function fetchBrandHealthOverview(projectId: string): Promise<{
  brandName: string
  overallScore: number
  scoreChange: number
  trend: 'improving' | 'stable' | 'declining'
  riskCount: number
  opportunityCount: number
  lastScanAt: string
}> {
  const report = await fetchBrandHealth(projectId)
  return {
    brandName: report.brandName,
    overallScore: report.overallScore,
    scoreChange: report.scoreChange,
    trend: report.trend,
    riskCount: report.topRisks.length,
    opportunityCount: report.topOpportunities.length,
    lastScanAt: report.lastScanAt,
  }
}
