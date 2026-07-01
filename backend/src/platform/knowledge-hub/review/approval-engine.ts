// ════════════════════════════════════════════════════════════
// KH3-T002 — ApprovalEngine
// ════════════════════════════════════════════════════════════
// Sole approval entry point.
// Produces ReadyToPublish decision for PublishingEngine.
// ════════════════════════════════════════════════════════════

import { ReviewEngine, ReviewDecision } from './review-engine'
import { ReviewPolicyEngine } from './review-policy'
import { ApprovalResult } from './types'

export class ApprovalEngine {
  constructor(
    private reviewEngine: ReviewEngine,
    private policyEngine: ReviewPolicyEngine,
  ) {}

  async approve(
    reviewId: string,
    by: string,
    comment: string,
    publishTargets: string[] = [],
  ): Promise<ApprovalResult | null> {
    const review = await this.reviewEngine.getReview(reviewId)
    if (!review) return null

    const decision: ReviewDecision = {
      status: 'approved',
      comment,
      by,
    }

    const updated = await this.reviewEngine.submitDecision(reviewId, decision)
    if (!updated) return null

    return {
      approved: true,
      reviewId,
      packageId: review.packageId,
      decision: 'approved',
      publishTargets,
      completedAt: updated.completedAt!,
    }
  }

  async requestChanges(
    reviewId: string,
    by: string,
    comment: string,
  ): Promise<ApprovalResult | null> {
    const review = await this.reviewEngine.getReview(reviewId)
    if (!review) return null

    const decision: ReviewDecision = {
      status: 'changes_requested',
      comment,
      by,
    }

    const updated = await this.reviewEngine.submitDecision(reviewId, decision)
    if (!updated) return null

    return {
      approved: false,
      reviewId,
      packageId: review.packageId,
      decision: 'changes_requested',
      publishTargets: [],
      completedAt: updated.completedAt!,
    }
  }
}
