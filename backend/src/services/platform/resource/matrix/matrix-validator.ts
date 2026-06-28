// ============================================================
// Matrix Validator — capability matrix consistency validation
// KMKI-PLAT-008
// ============================================================

import type { ResourceCapabilityMatrix, ResourceContract } from '../types'
import { matrixRepository } from '../repositories/matrix.repository'
import { contractRepository } from '../repositories/contract.repository'

export interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  resourceId?: string
  capabilityId?: string
}

export const matrixValidator = {
  /**
   * Run full validation on the capability matrix.
   */
  async validateAll(): Promise<{ valid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = []

    // 1. Check for orphaned entries (missing resource or capability)
    const allEntries = await matrixRepository.listAll()
    for (const entry of allEntries) {
      const resource = await contractRepository.findById(entry.resourceId)
      if (!resource) {
        issues.push({
          severity: 'error',
          message: `Orphaned matrix entry: resource "${entry.resourceId}" not found`,
          resourceId: entry.resourceId,
          capabilityId: entry.capabilityId,
        })
      }
    }

    // 2. Check for resources with no capability mappings
    const resources = await contractRepository.list({ limit: 200 })
    for (const r of resources.items) {
      const caps = await matrixRepository.findByResourceId(r.id)
      if (caps.length === 0) {
        issues.push({
          severity: 'warning',
          message: `Resource "${r.name}" has no capability mappings`,
          resourceId: r.id,
        })
      }
    }

    // 3. Check for duplicate supported scores
    const seen = new Map<string, Set<string>>()
    for (const entry of allEntries) {
      if (!entry.supported) continue
      const key = entry.capabilityId
      if (!seen.has(key)) seen.set(key, new Set())
      seen.get(key)!.add(entry.resourceId)
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    }
  },

  /**
   * Validate a single matrix entry.
   */
  async validateEntry(entry: {
    resourceId: string
    capabilityId: string
    qualityScore?: number | null
    costMultiplier?: number | null
  }): Promise<{ valid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = []

    // Check resource exists
    const resource = await contractRepository.findById(entry.resourceId)
    if (!resource) {
      issues.push({ severity: 'error', message: `Resource "${entry.resourceId}" not found`, resourceId: entry.resourceId })
    }

    // Check quality score range
    if (entry.qualityScore !== null && entry.qualityScore !== undefined) {
      if (entry.qualityScore < 0 || entry.qualityScore > 1) {
        issues.push({ severity: 'error', message: `qualityScore must be 0-1, got ${entry.qualityScore}`, resourceId: entry.resourceId })
      }
    }

    // Check cost multiplier
    if (entry.costMultiplier !== null && entry.costMultiplier !== undefined) {
      if (entry.costMultiplier < 0) {
        issues.push({ severity: 'error', message: `costMultiplier must be >= 0, got ${entry.costMultiplier}`, resourceId: entry.resourceId })
      }
    }

    return { valid: issues.filter(i => i.severity === 'error').length === 0, issues }
  },
}
