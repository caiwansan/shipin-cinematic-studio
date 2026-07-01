// ════════════════════════════════════════════════════════════
// KDP Service 3: AttemptSchedulerService
// ════════════════════════════════════════════════════════════
// Input: Approved DistributionPlan
// Output: DistributionAttempt(s) — scheduled, not delivered
// FR-K2: Attempt-based history (append-only, never overwrite)
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { DistributionPlan, DistributionAttempt, DistributionTarget, AttemptStatus } from '../types'

export class AttemptSchedulerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Schedule distribution attempts for an approved plan.
   * Creates one attempt per adapter type specified in the plan's targets.
   * Does NOT deliver — only creates the attempt records.
   */
  async scheduleAttempts(
    plan: DistributionPlan,
    adapterIds: string[]
  ): Promise<DistributionAttempt[]> {
    if (plan.status !== 'approved') {
      throw new Error(`Cannot schedule: plan ${plan.id} is ${plan.status}, not 'approved'`)
    }

    const attempts: DistributionAttempt[] = []

    for (const adapterId of adapterIds) {
      // Check if there's already a pending attempt for this plan+adapter
      const existing = await this.prisma.distributionAttempt.findFirst({
        where: { planId: plan.id, adapterId, status: AttemptStatus.Pending },
      })
      if (existing) {
        continue // Don't duplicate pending attempts
      }

      // Determine attempt number
      const previousAttempts = await this.prisma.distributionAttempt.findMany({
        where: { planId: plan.id, adapterId },
        orderBy: { attemptNo: 'desc' },
        take: 1,
      })
      const attemptNo = previousAttempts.length > 0 ? previousAttempts[0].attemptNo + 1 : 1

      const attempt = await this.prisma.distributionAttempt.create({
        data: {
          planId: plan.id,
          adapterId,
          assetIds: JSON.stringify(plan.assetIds),
          attemptNo,
          status: AttemptStatus.Pending,
        },
      })

      attempts.push(this.toAttemptDTO(attempt))
    }

    // Update plan status to 'distributing'
    await this.prisma.distributionPlan.update({
      where: { id: plan.id },
      data: { status: 'distributing' },
    })

    return attempts
  }

  /**
   * Get all pending attempts that are ready for delivery.
   * Adapter layer (K2) will consume these.
   */
  async getPendingAttempts(limit = 10): Promise<DistributionAttempt[]> {
    const attempts = await this.prisma.distributionAttempt.findMany({
      where: { status: AttemptStatus.Pending },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return attempts.map(a => this.toAttemptDTO(a))
  }

  /**
   * Mark an attempt as running (adapter picked it up).
   */
  async markRunning(attemptId: string): Promise<DistributionAttempt> {
    const attempt = await this.prisma.distributionAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.Preparing,
        startedAt: new Date(),
      },
    })
    return this.toAttemptDTO(attempt)
  }

  /**
   * Mark an attempt as failed with error log.
   */
  async markFailed(attemptId: string, errorLog: string): Promise<DistributionAttempt> {
    const attempt = await this.prisma.distributionAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.Failed,
        errorLog,
        finishedAt: new Date(),
      },
    })
    return this.toAttemptDTO(attempt)
  }

  /**
   * Mark an attempt as successful.
   */
  async markSuccess(attemptId: string, outputUrl: string, artifactHash: string, durationMs: number): Promise<DistributionAttempt> {
    const attempt = await this.prisma.distributionAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.Success,
        outputUrl,
        artifactHash,
        durationMs,
        finishedAt: new Date(),
      },
    })

    // Check if all attempts for this plan are done
    await this.checkPlanCompletion(attempt.planId)

    return this.toAttemptDTO(attempt)
  }

  // ─── Private ───

  private async checkPlanCompletion(planId: string) {
    const attempts = await this.prisma.distributionAttempt.findMany({
      where: { planId },
    })
    const allDone = attempts.every(
      a => a.status === AttemptStatus.Success || a.status === AttemptStatus.Failed
    )
    if (allDone) {
      await this.prisma.distributionPlan.update({
        where: { id: planId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })
    }
  }

  private toAttemptDTO(a: any): DistributionAttempt {
    return {
      id: a.id,
      planId: a.planId,
      adapterId: a.adapterId,
      attemptNo: a.attemptNo,
      assetIds: typeof a.assetIds === 'string' ? JSON.parse(a.assetIds) : a.assetIds,
      status: a.status as AttemptStatus,
      outputUrl: a.outputUrl ?? undefined,
      artifactHash: a.artifactHash ?? undefined,
      durationMs: a.durationMs ?? undefined,
      errorLog: a.errorLog ?? undefined,
      startedAt: a.startedAt?.toISOString(),
      finishedAt: a.finishedAt?.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }
  }
}
