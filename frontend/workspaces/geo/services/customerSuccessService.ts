import { geoApi } from './api'
import { getToken as getCachedToken } from '~/utils/token-cache'

// 获取 token（使用全局 token-cache，支持内存 + localStorage 多层兜底）
function getToken(): string {
  try { return getCachedToken() } catch {}
  return ''
}

// Local type definition matching backend CustomerSuccessReport
export interface CustomerSuccessReport {
  congratulations: string
  projectedImpact: {
    aiExposureIncrease: number
    aiCitationIncrease: number
    newInquiries: number
    timeFrame: string
  }
  nextActions: Array<{
    action: string
    estimatedImpact: string
    timeToComplete: string
    suggestedDate: string
  }>
  summary: string
}

const API_BASE = '/api/geo'

/**
 * Fetch the customer success report for a given project.
 * @param projectId - The project identifier
 * @param options - Optional query parameters for customizing the report
 */
export async function fetchCustomerSuccessReport(
  projectId: string,
  options?: {
    impact?: number
    publishingImpact?: number
    healthScore?: number
    aiVisibility?: number
  }
): Promise<CustomerSuccessReport> {
  const params = new URLSearchParams()
  if (options?.impact) params.set('impact', String(options.impact))
  if (options?.publishingImpact) params.set('publishingImpact', String(options.publishingImpact))
  if (options?.healthScore) params.set('healthScore', String(options.healthScore))
  if (options?.aiVisibility) params.set('aiVisibility', String(options.aiVisibility))

  const queryStr = params.toString()
  const url = `${API_BASE}/projects/${projectId}/customer-success${queryStr ? `?${queryStr}` : ''}`

  const token = getToken()
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Failed to fetch customer success report: ${response.status} ${errorBody}`)
  }

  const json = await response.json()
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Invalid response from customer success API')
  }

  return json.data as CustomerSuccessReport
}
