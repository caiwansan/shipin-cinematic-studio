// ════════════════════════════════════════════════════════════
// KH1-T002 — PackageValidator
// ════════════════════════════════════════════════════════════
// Single source of truth for KnowledgePackage validation.
// No Workspace should validate packages themselves.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from './types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class PackageValidator {
  validate(pkg: KnowledgePackage): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // ── Identity ──
    if (!pkg.id) errors.push('id is required')
    if (!pkg.workspace) errors.push('workspace is required')
    if (!['geo', 'novel', 'drama', 'ppt'].includes(pkg.workspace)) {
      errors.push(`invalid workspace: ${pkg.workspace}`)
    }
    if (!pkg.entityType) errors.push('entityType is required')
    if (!pkg.entityId) errors.push('entityId is required')
    if (!pkg.title) errors.push('title is required')
    if (!pkg.version) errors.push('version is required')

    // ── Status ──
    const validStatuses = ['draft', 'review', 'approved', 'published', 'archived']
    if (!validStatuses.includes(pkg.status)) {
      errors.push(`invalid status: ${pkg.status}`)
    }

    // ── Claims ──
    if (!Array.isArray(pkg.claims)) {
      errors.push('claims must be an array')
    } else {
      for (const [i, claim] of pkg.claims.entries()) {
        if (!claim.id) errors.push(`claims[${i}]: id required`)
        if (!claim.text) errors.push(`claims[${i}]: text required`)
        if (!claim.category) warnings.push(`claims[${i}]: no category`)
      }
    }

    // ── Evidence ──
    if (!Array.isArray(pkg.evidence)) {
      errors.push('evidence must be an array')
    } else {
      for (const [i, ev] of pkg.evidence.entries()) {
        if (!ev.id) errors.push(`evidence[${i}]: id required`)
        if (!ev.source) warnings.push(`evidence[${i}]: no source`)
      }
    }

    // ── Assets ──
    if (!Array.isArray(pkg.assets)) {
      errors.push('assets must be an array')
    } else {
      for (const [i, asset] of pkg.assets.entries()) {
        if (!asset.url && !asset.content) {
          warnings.push(`assets[${i}]: no url or content`)
        }
      }
    }

    // ── Citations ──
    if (!Array.isArray(pkg.citations)) {
      errors.push('citations must be an array')
    }

    // ── Publishing Targets ──
    if (!Array.isArray(pkg.publishingTargets)) {
      errors.push('publishingTargets must be an array')
    }

    // ── Timestamps ──
    if (!pkg.createdAt) errors.push('createdAt is required')
    if (!pkg.updatedAt) errors.push('updatedAt is required')

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
