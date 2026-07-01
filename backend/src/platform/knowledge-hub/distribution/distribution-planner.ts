// ════════════════════════════════════════════════════════════
// KH4-T002 — DistributionPlanner
// Converts publishTargets[] into DistributionPlan.
// Planner does NOT execute — only plans.
// ════════════════════════════════════════════════════════════

import { DistributionPlan } from './types'

export class DistributionPlanner {
  async createPlan(packageId: string, targets: string[]): Promise<DistributionPlan> {
    return {
      id: crypto.randomUUID(),
      packageId,
      targets,
      createdAt: new Date().toISOString(),
    }
  }
}
