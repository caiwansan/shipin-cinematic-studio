// ============================================================
// RuntimeReadinessService — AI Runtime Console Readiness Scoring
// ============================================================
// Extracted from credential-lifecycle.service.ts scoring logic.
// Pure computation service with configurable weights.
// Does NOT access the database or Prisma.
// ============================================================

import type { RuntimeSummaryResult } from './credential-lifecycle.service.js'

/**
 * Status weight configuration for readiness scoring.
 * 
 * Mapping of credential lifecycle status → contribution weight (0-100).
 * Adjust these values to change scoring behavior without touching code.
 */
export const DEFAULT_READINESS_WEIGHTS: Record<string, number> = {
  ACTIVE: 100,
  VALIDATING: 50,
  NEW: 50,
  REQUIRES_RECONFIGURATION: 10,
  INVALID: 0,
  DISABLED: 0,
}

export type ReadinessCategory = 'critical' | 'warning' | 'healthy' | 'excellent'

export interface CapabilityStatus {
  aiAvailable: boolean
  reason: string | null
}

/**
 * Calculate overall readiness score (0-100) from credential lifecycle counts.
 * 
 * @param total - Total number of credentials
 * @param active - Count of ACTIVE credentials
 * @param reconfig - Count of REQUIRES_RECONFIGURATION credentials
 * @param invalid - Count of INVALID credentials
 * @param disabled - Count of DISABLED credentials
 * @param weights - Optional custom weight configuration (uses DEFAULT_READINESS_WEIGHTS if omitted)
 * @returns Readiness score between 0 and 100
 */
export function calculateReadiness(
  total: number,
  active: number,
  reconfig: number,
  invalid: number,
  disabled: number,
  weights: Record<string, number> = DEFAULT_READINESS_WEIGHTS,
): number {
  if (total === 0) return 100

  // All credentials contribute — we use the counts per status to compute a weighted average
  // The original algorithm in credential-lifecycle.service.ts iterates over all entries
  // and sums weights. Here we derive the same result from counts.
  //
  // We have 6 statuses: ACTIVE, VALIDATING, NEW, REQUIRES_RECONFIGURATION, INVALID, DISABLED
  // The remaining credentials (not explicitly counted) are VALIDATING or NEW.
  const remaining = total - active - reconfig - invalid - disabled

  const sum =
    (active * (weights.ACTIVE ?? 100)) +
    (remaining * (weights.VALIDATING ?? 50)) +
    (reconfig * (weights.REQUIRES_RECONFIGURATION ?? 10)) +
    (invalid * (weights.INVALID ?? 0)) +
    (disabled * (weights.DISABLED ?? 0))

  return Math.round(sum / total)
}

/**
 * Map a readiness score to a product category.
 * 
 * - 0-49: critical — AI Runtime is significantly impaired
 * - 50-74: warning — Some features may be limited
 * - 75-89: healthy — Most features are operational
 * - 90-100: excellent — Full AI capability
 */
export function getCategory(readinessScore: number): ReadinessCategory {
  if (readinessScore < 50) return 'critical'
  if (readinessScore < 75) return 'warning'
  if (readinessScore < 90) return 'healthy'
  return 'excellent'
}

/**
 * Determine whether AI capabilities are available based on runtime summary.
 * 
 * AI is available when:
 * - readinessScore >= 50 (minimum threshold)
 * - reconfigurationRequired < totalCredentials (not all credentials need reconfiguration)
 * 
 * Returns product-language reason when AI is not available,
 * without exposing encryption or cryptographic details.
 */
export function getCapabilityStatus(summary: RuntimeSummaryResult): CapabilityStatus {
  const { readinessScore, totalCredentials, reconfigurationRequired } = summary

  if (totalCredentials === 0) {
    return {
      aiAvailable: false,
      reason: '尚未配置任何 AI Provider，请先添加 API Key',
    }
  }

  if (readinessScore < 50) {
    return {
      aiAvailable: false,
      reason: 'AI Runtime 健康度过低，大部分 Provider 不可用，请检查配置',
    }
  }

  if (reconfigurationRequired >= totalCredentials) {
    return {
      aiAvailable: false,
      reason: '所有 Provider 均需要重新配置，AI 功能暂时不可用',
    }
  }

  if (reconfigurationRequired > 0) {
    return {
      aiAvailable: true,
      reason: '部分 Provider 需要重新配置，AI 功能可能受限',
    }
  }

  return {
    aiAvailable: true,
    reason: null,
  }
}
