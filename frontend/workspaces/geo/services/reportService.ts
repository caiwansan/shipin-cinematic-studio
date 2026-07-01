/**
 * GEO Report Service — Report Center API
 *
 * P1-C: Deliverable Center
 *
 * GET  /api/geo/report/:projectId        → Full report
 * GET  /api/geo/report/:projectId/export  → Export
 */
import { geoApi } from './api'
import type { DeliverableReport } from '../types/report'

/**
 * Fetch the full DeliverableReport for a project
 */
export async function fetchReport(projectId: string): Promise<DeliverableReport | null> {
  try {
    const raw = await geoApi<{ success: boolean; data: DeliverableReport }>(
      `report/${projectId}`,
      { method: 'GET' }
    )
    return raw.data
  } catch (err: any) {
    if (err.response?.status === 404) return null
    throw err
  }
}

/**
 * Export report in a specific format
 */
export async function exportReport(
  projectId: string,
  format: 'markdown' | 'json' = 'json'
): Promise<{ format: string; content: string | DeliverableReport }> {
  const raw = await geoApi<{ success: boolean; data: { format: string; content: string | DeliverableReport } }>(
    `report/${projectId}/export`,
    {
      method: 'POST',
      body: { format },
    }
  )
  return raw.data
}
