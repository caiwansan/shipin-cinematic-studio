// ════════════════════════════════════════════════════════════
// KH4-T003 — Website Distribution Target
// ════════════════════════════════════════════════════════════

import { DistributionTarget, DistributionTargetCapability } from '../types'

export class WebsiteDistributionTarget implements DistributionTarget {
  name = 'website'
  type = 'website'
  capabilities: DistributionTargetCapability[] = ['supports_rollback', 'supports_preview']

  async execute(packageId: string, planId: string): Promise<{ success: boolean; artifactUrl?: string; error?: string }> {
    return { success: true, artifactUrl: `/distribution/${planId}/website/index.html` }
  }
}
