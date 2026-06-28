// ============================================================
// Review Routes — CRUD + approve/reject for Review
// API: /api/goal/review/*
// ============================================================

import { reviewRepository } from '../../services/goal/repositories/review.repository.js'
import { goalRuntime } from '../../services/goal/runtime/goal.runtime.js'

export default async function reviewRoutes(fastify: any) {
  // Create review for an execution
  fastify.post('/api/goal/review', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.executionId) {
      return reply.status(400).send({ success: false, error: 'executionId is required' })
    }
    const review = await goalRuntime.createReview(body.executionId)
    return { success: true, data: review }
  })

  // List reviews
  fastify.get('/api/goal/review', async (request: any, reply: any) => {
    const query = request.query as any
    const reviews = await reviewRepository.list(query.executionId)
    return { success: true, data: { items: reviews, total: reviews.length } }
  })

  // Get review by ID
  fastify.get('/api/goal/review/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const review = await reviewRepository.findById(id)
    if (!review) return reply.status(404).send({ success: false, error: 'Review not found' })
    return { success: true, data: review }
  })

  // Approve review
  fastify.post('/api/goal/review/:id/approve', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const result = await goalRuntime.approveReview(id, body.comments, body.score)
    return { success: true, data: result }
  })

  // Reject review
  fastify.post('/api/goal/review/:id/reject', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const result = await goalRuntime.rejectReview(id, body.comments)
    return { success: true, data: result }
  })

  // Request revision
  fastify.post('/api/goal/review/:id/revision', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    if (!body.comments) {
      return reply.status(400).send({ success: false, error: 'comments are required for revision' })
    }
    const { reviewLoop } = await import('../../services/goal/review/review-loop.js')
    const result = await reviewLoop.requestRevision(id, body.comments)
    return { success: true, data: result }
  })

  // Delete review
  fastify.delete('/api/goal/review/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await reviewRepository.delete(id)
    return { success: true }
  })
}
