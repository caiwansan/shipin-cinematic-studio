import { geoApi } from './api'

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
  const url = `/projects/${projectId}/customer-success${queryStr ? `?${queryStr}` : ''}`

  const res = await geoApi.get<{ success: boolean; data: CustomerSuccessReport }>(url)
  return res.data
}
