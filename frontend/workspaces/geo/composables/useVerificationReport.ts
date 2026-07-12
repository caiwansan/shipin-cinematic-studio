/**
 * useVerificationReport — Adapter to wrap API VerificationReport into meta + payload structure
 *
 * The current VerificationReport from verificationService does NOT have meta + payload nesting.
 * This adapter wraps the API response into the standard meta + payload structure.
 */
import type {
  VerificationReport,
  VerificationPayload,
  VerificationMeta,
  BreakdownSection,
} from '../components/GeoVerificationPattern/types'
import type { VerificationReport as RawVerificationReport } from '../services/verificationService'

/**
 * Adapt a raw API VerificationReport into the meta + payload structure
 * expected by GeoVerificationPattern.
 */
export function adaptVerificationReport(raw: RawVerificationReport): VerificationReport {
  // Build breakdowns from improvementBreakdown if available
  const breakdowns: BreakdownSection[] = []

  if (raw.improvementBreakdown && raw.improvementBreakdown.length > 0) {
    breakdowns.push({
      type: 'waterfall',
      label: '改进瀑布图',
      data: {
        baseline: raw.beforeAdi,
        items: raw.improvementBreakdown.map((item) => ({
          label: item.label,
          contribution: item.contribution,
          detail: item.detail,
        })),
      },
    })
  }

  const meta: VerificationMeta = {
    entityName: raw.entityName,
    entityType: 'entity',
    reportId: raw.id || `verification-${Date.now()}`,
    generatedAt: raw.verifiedAt || new Date().toISOString(),
    duration: 0,
    source: 'manual',
  }

  const payload: VerificationPayload = {
    beforeAdi: raw.beforeAdi,
    afterAdi: raw.afterAdi,
    deltaAdi: raw.deltaAdi,
    improvementRate: raw.improvementRate,
    completionRate: raw.completionRate,
    totalActions: raw.totalActions,
    completedActions: raw.completedActions,
    pendingActions: raw.pendingActions,
    skippedActions: raw.skippedActions,
    dimensionChanges: raw.dimensionChanges,
    breakdowns,
    verifiedItems: raw.verifiedItems.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      adiContribution: item.adiContribution,
      details: item.details,
    })),
    remainingIssues: raw.remainingIssues.map((issue) => ({
      scenarioId: issue.scenarioId,
      scenarioName: issue.scenarioName,
      gap: issue.gap,
      priority: issue.priority,
    })),
    confidence: raw.confidence,
  }

  return { meta, payload }
}

/**
 * Composable for use in pages that need verification report adapter.
 */
export function useVerificationReport() {
  function adapt(raw: RawVerificationReport): VerificationReport {
    return adaptVerificationReport(raw)
  }

  return { adapt }
}
