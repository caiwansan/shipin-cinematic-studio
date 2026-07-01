// ════════════════════════════════════════════════════════════
// KH1-T001 — PackageBuilder
// ════════════════════════════════════════════════════════════
// Platform Canonical KnowledgePackage Builder.
// Does NOT know about GEO, Novel, Drama, or any Workspace.
// Only depends on KnowledgeProvider interface.
// ════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid'
import { KnowledgePackage, KnowledgeProvider } from './types'
import { PackageValidator, ValidationResult } from './package-validator'

export interface BuildOptions {
  workspace: string
  entityType: string
  entityId: string
  title: string
  description?: string
  tags?: string[]
  bypassValidation?: boolean
}

export interface BuildResult {
  success: boolean
  pkg?: KnowledgePackage
  errors?: string[]
}

export class PackageBuilder {
  constructor(
    private validator: PackageValidator,
  ) {}

  async build(
    provider: KnowledgeProvider,
    options: BuildOptions,
  ): Promise<BuildResult> {
    const pkg: KnowledgePackage = {
      // ── Identity ──
      id: uuid(),
      workspace: options.workspace,
      entityType: options.entityType,
      entityId: options.entityId,
      title: options.title,
      description: options.description ?? '',
      version: '1.0.0',

      // ── Status ──
      status: 'draft',
      statusHistory: [{
        from: 'created',
        to: 'draft',
        at: new Date().toISOString(),
        by: 'PackageBuilder',
      }],

      // ── Content (filled by provider) ──
      claims: [],
      evidence: [],
      assets: [],
      citations: [],
      tags: options.tags ?? [],

      // ── Provider-specific (optional) ──
      recommendations: [],

      // ── Publishing ──
      publishingTargets: [],

      // ── Timestamps ──
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Let provider fill the content
    const enriched = await provider.buildContent(pkg)
    if (!enriched) {
      return { success: false, errors: ['Provider returned null'] }
    }

    // Parse asset data from provider
    enriched.claims = provider.getClaims?.(enriched) ?? []
    enriched.evidence = provider.getEvidence?.(enriched) ?? []
    enriched.assets = provider.getAssets?.(enriched) ?? []
    enriched.citations = provider.getCitations?.(enriched) ?? []
    enriched.publishingTargets = provider.getPublishingTargets?.(enriched) ?? []

    // Validate
    if (!options.bypassValidation) {
      const validation = this.validator.validate(enriched)
      if (!validation.valid) {
        return { success: false, errors: validation.errors }
      }
    }

    return { success: true, pkg: enriched }
  }
}
