// ============================================================
// GEO Review Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoReviewRepository } from '../repositories/geo-review.repository'
import type { ReviewQueueItem } from '../types'
import { createProvenanceRecord, ReviewState } from '../types'

export const geoReviewService = {
  /**
   * Add an item to the review queue.
   */
  async enqueue(data: {
    projectId: string
    reviewableType: string
    reviewableId: string
    state?: string
    provenance?: any
  }): Promise<ReviewQueueItem> {
    return geoReviewRepository.create({
      projectId: data.projectId,
      reviewableType: data.reviewableType,
      reviewableId: data.reviewableId,
      state: data.state || ReviewState.Draft,
      provenance: data.provenance || createProvenanceRecord({
        source: 'geo.review',
        action: 'created',
        actor: 'service:geo.review',
        reason: `Review enqueued for ${data.reviewableType}:${data.reviewableId}`,
      }),
    })
  },

  /**
   * Approve a reviewable item.
   */
  async approve(id: string, reviewerId: string, notes?: string): Promise<ReviewQueueItem | null> {
    await geoReviewRepository.updateReview(id, { reviewerId, reviewNotes: notes })
    return geoReviewRepository.transitionState(id, ReviewState.Approved, createProvenanceRecord({
      source: 'geo.review',
      action: 'approved',
      actor: `user:${reviewerId}`,
      reason: notes || 'Approved',
    }))
  },

  /**
   * Reject a reviewable item.
   */
  async reject(id: string, reviewerId: string, notes?: string): Promise<ReviewQueueItem | null> {
    await geoReviewRepository.updateReview(id, { reviewerId, reviewNotes: notes })
    return geoReviewRepository.transitionState(id, ReviewState.Rejected, createProvenanceRecord({
      source: 'geo.review',
      action: 'rejected',
      actor: `user:${reviewerId}`,
      reason: notes || 'Rejected',
    }))
  },

  /**
   * Request revision for a reviewable item.
   */
  async requestRevision(id: string, reviewerId: string, notes: string): Promise<ReviewQueueItem | null> {
    await geoReviewRepository.updateReview(id, { reviewerId, reviewNotes: notes })
    return geoReviewRepository.transitionState(id, ReviewState.RequestRevision, createProvenanceRecord({
      source: 'geo.review',
      action: 'updated',
      actor: `user:${reviewerId}`,
      reason: notes,
    }))
  },

  /**
   * Get pending review items for a project.
   */
  async getPendingQueue(projectId: string): Promise<ReviewQueueItem[]> {
    return geoReviewRepository.findByState(projectId, ReviewState.Draft)
  },

  /**
   * Get all review items for a project.
   */
  async listByProject(projectId: string): Promise<ReviewQueueItem[]> {
    return geoReviewRepository.findByProjectId(projectId)
  },

  /**
   * Get review status summary for a project.
   */
  async getProjectReviewSummary(projectId: string): Promise<Record<string, number>> {
    return geoReviewRepository.countByState(projectId)
  },
}
