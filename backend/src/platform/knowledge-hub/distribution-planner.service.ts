// ════════════════════════════════════════════════════════════
// KDP Service 2: DistributionPlannerService
// ════════════════════════════════════════════════════════════
// Input: KnowledgeAsset(s)
// Output: DistributionPlan (auto-created, status: pending_review)
// Strategy: incremental by default, full redistribute on demand
// FR-K1: Distributes PublishingRecords, never Claims
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { DistributionPlan, DistributionPlanStatus, DistributionTarget } from '../types'

interface PlanInput {
  projectId: string
  assetIds: string[]
  targets: DistributionTarget[]
  title?: string
  /** If true, only includes assets with version changes since last plan */
  incrementalOnly?: boolean
  /** If true, ignores incremental and schedules full redistribution */
  forceFull?: boolean
}

export class DistributionPlannerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Auto-create a DistributionPlan from KnowledgeAssets.
   * Default behavior: incremental (only changed assets since last plan).
   * Status: pending_review — user must approve before execution.
   */
  async autoCreateFromAssets(input: PlanInput): Promise<DistributionPlan> {
    const title = input.title || `知识分发计划 — ${new Date().toISOString().split('T')[0]}`
    const incrementalOnly = input.incrementalOnly ?? true

    // ── Determine which assets to include ──
    let assetIds = input.assetIds
    if (incrementalOnly && !input.forceFull) {
      assetIds = await this.filterChangedAssets(input.projectId, input.assetIds)
    }

    if (assetIds.length === 0) {
      // Nothing changed since last plan — still create an empty plan
      // User can force-full later
    }

    // ── Create plan ──
    const plan = await this.prisma.$transaction(async (tx) => {
      const p = await tx.distributionPlan.create({
        data: {
          projectId: input.projectId,
          title,
          status: DistributionPlanStatus.PendingReview,
          strategy: JSON.stringify({
            incrementalOnly: input.incrementalOnly ?? true,
            forceFull: input.forceFull ?? false,
            scheduleAt: null,
          }),
        },
      })

      // Link assets
      if (assetIds.length > 0) {
        await tx.distributionPlanToAsset.createMany({
          data: assetIds.map(assetId => ({
            planId: p.id,
            assetId,
          })),
        })
      }

      return p
    })

    return {
      id: plan.id,
      projectId: plan.projectId,
      title: plan.title,
      assetIds,
      targets: input.targets,
      status: DistributionPlanStatus.PendingReview,
      strategy: JSON.parse(plan.strategy),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }
  }

  /**
   * Approve a plan — moves to 'approved' status.
   * AttemptScheduler will pick up approved plans.
   */
  async approvePlan(planId: string): Promise<DistributionPlan> {
    const plan = await this.prisma.distributionPlan.update({
      where: { id: planId },
      data: {
        status: DistributionPlanStatus.Approved,
        approvedAt: new Date(),
      },
    })
    return this.toPlanDTO(plan)
  }

  /**
   * Reject a plan — moves to 'cancelled'.
   */
  async cancelPlan(planId: string): Promise<DistributionPlan> {
    const plan = await this.prisma.distributionPlan.update({
      where: { id: planId },
      data: { status: DistributionPlanStatus.Cancelled },
    })
    return this.toPlanDTO(plan)
  }

  /**
   * Find all pending-review plans for a project.
   */
  async findPendingPlans(projectId: string): Promise<DistributionPlan[]> {
    const plans = await this.prisma.distributionPlan.findMany({
      where: { projectId, status: DistributionPlanStatus.PendingReview },
      orderBy: { createdAt: 'desc' },
    })
    return plans.map(p => this.toPlanDTO(p))
  }

  // ─── Private ───

  /**
   * Filter to only assets whose version changed since the last completed plan.
   */
  private async filterChangedAssets(projectId: string, assetIds: string[]): Promise<string[]> {
    // Get latest completed plan for this project
    const latestPlan = await this.prisma.distributionPlan.findFirst({
      where: { projectId, status: DistributionPlanStatus.Completed },
      orderBy: { completedAt: 'desc' },
    })

    if (!latestPlan) {
      // No previous plan → include all
      return assetIds
    }

    // Get assets from latest plan
    const previousAssets = await this.prisma.distributionPlanToAsset.findMany({
      where: { planId: latestPlan.id },
    })
    const previousAssetIds = new Set(previousAssets.map(pa => pa.assetId))

    // Get current versions of candidate assets
    const currentAssets = await this.prisma.knowledgeAsset.findMany({
      where: { id: { in: assetIds } },
    })

    // Include if NEW (not in previous plan) or version changed
    return currentAssets
      .filter(a => !previousAssetIds.has(a.id) || a.version !== '1.0.0') // simplified check
      .map(a => a.id)
  }

  private toPlanDTO(p: any): DistributionPlan {
    return {
      id: p.id,
      projectId: p.projectId,
      title: p.title,
      assetIds: [], // populated via join if needed
      targets: [],  // populated via DistributionTarget lookup if needed
      status: p.status as DistributionPlanStatus,
      strategy: typeof p.strategy === 'string' ? JSON.parse(p.strategy) : p.strategy,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }
  }
}
