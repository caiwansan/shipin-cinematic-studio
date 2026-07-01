// ════════════════════════════════════════════════════════════
// KH3-T001 — ReviewEngine
// ════════════════════════════════════════════════════════════
// Creates reviews, manages comments, tracks status.
// Does NOT approve — only produces ReviewDecision.
// ════════════════════════════════════════════════════════════

import { ReviewRecord, ReviewComment, ReviewStatus } from './types'

export interface ReviewDecision {
  status: 'approved' | 'changes_requested'
  comment: string
  by: string
}

export class ReviewEngine {
  private reviews: Map<string, ReviewRecord> = new Map()

  async createReview(packageId: string, reviewers: string[], initiatedBy: string): Promise<ReviewRecord> {
    const review: ReviewRecord = {
      id: crypto.randomUUID(),
      packageId,
      status: 'in_review',
      reviewers,
      comments: [],
      decision: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    this.reviews.set(review.id, review)
    return review
  }

  async getReview(id: string): Promise<ReviewRecord | null> {
    return this.reviews.get(id) || null
  }

  async listReviews(packageId?: string): Promise<ReviewRecord[]> {
    const all = Array.from(this.reviews.values())
    return packageId ? all.filter(r => r.packageId === packageId) : all
  }

  async addComment(reviewId: string, author: string, content: string): Promise<ReviewRecord | null> {
    const review = this.reviews.get(reviewId)
    if (!review) return null
    if (review.status === 'approved') return null // Can't comment on approved

    const comment: ReviewComment = {
      id: crypto.randomUUID(),
      author,
      content,
      createdAt: new Date().toISOString(),
    }
    review.comments.push(comment)
    return review
  }

  async submitDecision(reviewId: string, decision: ReviewDecision): Promise<ReviewRecord | null> {
    const review = this.reviews.get(reviewId)
    if (!review) return null
    if (review.status !== 'in_review') return null

    review.decision = decision.comment
    review.status = decision.status
    review.completedAt = new Date().toISOString()

    if (decision.status === 'changes_requested') {
      // Re-open for changes
      review.status = 'changes_requested'
    }

    return review
  }

  async reopenReview(reviewId: string): Promise<ReviewRecord | null> {
    const review = this.reviews.get(reviewId)
    if (!review) return null
    if (review.status !== 'changes_requested') return null

    review.status = 'in_review'
    review.decision = null
    review.completedAt = null
    return review
  }
}
