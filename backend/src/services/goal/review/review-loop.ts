// ============================================================
// Review Loop — Validate, compare, close/reopen
// The single closure entry point for the Goal Runtime
// ============================================================

import { reviewRepository } from '../repositories/review.repository.js'
import { executionRepository } from '../repositories/execution.repository.js'
import { taskRepository } from '../repositories/task.repository.js'
import type { ReviewData, ExecutionData, TaskData, GoalEvent } from '../types.js'

export interface ReviewResult {
  review: ReviewData
  action: 'approve' | 'reject' | 'revision'
  summary: string
}

export class ReviewLoop {
  /**
   * Create a new review for an execution
   */
  async createReview(executionId: string, initialStatus?: string): Promise<ReviewData> {
    const execution = await executionRepository.findById(executionId)
    if (!execution) throw new Error(`Execution not found: ${executionId}`)

    const review = await reviewRepository.create({
      executionId,
      status: initialStatus || 'pending',
      schemaVersion: 1,
    })

    return review
  }

  /**
   * Approve an execution's results
   */
  async approve(reviewId: string, comments?: string, score?: number): Promise<ReviewResult> {
    const review = await reviewRepository.findById(reviewId)
    if (!review) throw new Error(`Review not found: ${reviewId}`)

    const updated = await reviewRepository.update(reviewId, {
      status: 'approved',
      comments: comments || review.comments,
      score: score ?? review.score,
    })

    // Mark the related task as completed (if it was pending review)
    const execution = await executionRepository.findById(review.executionId)
    if (execution) {
      const task = await taskRepository.findById(execution.taskId)
      if (task && task.status === 'running') {
        await taskRepository.update(task.id!, { status: 'completed' })
      }
    }

    return {
      review: updated,
      action: 'approve',
      summary: `Review ${reviewId} approved${comments ? ': ' + comments : ''}`,
    }
  }

  /**
   * Reject an execution's results
   */
  async reject(reviewId: string, comments?: string): Promise<ReviewResult> {
    const review = await reviewRepository.findById(reviewId)
    if (!review) throw new Error(`Review not found: ${reviewId}`)

    const updated = await reviewRepository.update(reviewId, {
      status: 'rejected',
      comments: comments || review.comments,
    })

    // Mark the related task as failed
    const execution = await executionRepository.findById(review.executionId)
    if (execution) {
      const task = await taskRepository.findById(execution.taskId)
      if (task) {
        await taskRepository.update(task.id!, { status: 'failed' })
      }
    }

    return {
      review: updated,
      action: 'reject',
      summary: `Review ${reviewId} rejected${comments ? ': ' + comments : ''}`,
    }
  }

  /**
   * Request revision for an execution's results
   */
  async requestRevision(reviewId: string, comments: string): Promise<ReviewResult> {
    const review = await reviewRepository.findById(reviewId)
    if (!review) throw new Error(`Review not found: ${reviewId}`)

    const updated = await reviewRepository.update(reviewId, {
      status: 'needs_revision',
      comments: comments,
    })

    // Reset the task to ready for re-execution
    const execution = await executionRepository.findById(review.executionId)
    if (execution) {
      const task = await taskRepository.findById(execution.taskId)
      if (task) {
        await taskRepository.update(task.id!, { status: 'ready' })
      }
    }

    return {
      review: updated,
      action: 'revision',
      summary: `Review ${reviewId} needs revision: ${comments}`,
    }
  }

  /**
   * Get all reviews for an execution
   */
  async getExecutionReviews(executionId: string): Promise<ReviewData[]> {
    return reviewRepository.findByExecution(executionId)
  }

  /**
   * Get review by ID
   */
  async getReview(id: string): Promise<ReviewData | null> {
    return reviewRepository.findById(id)
  }

  /**
   * List all reviews (optionally filtered by execution)
   */
  async listReviews(executionId?: string): Promise<ReviewData[]> {
    return reviewRepository.list(executionId)
  }
}

export const reviewLoop = new ReviewLoop()
