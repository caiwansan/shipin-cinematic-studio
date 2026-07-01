// ════════════════════════════════════════════════════════════
// KH3-T005 — Review API
// ════════════════════════════════════════════════════════════
// Publishing API does NOT handle review logic.
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { ReviewEngine } from './review-engine'
import { ApprovalEngine } from './approval-engine'
import { ReviewPolicyEngine } from './review-policy'
import { AuditTimeline } from './audit-timeline'

export function registerReviewRoutes(
  fastify: FastifyInstance,
  opts: {
    reviewEngine: ReviewEngine
    approvalEngine: ApprovalEngine
    policyEngine: ReviewPolicyEngine
    audit: AuditTimeline
  },
) {
  // ── POST /knowledge/reviews — Create review ──
  fastify.post('/api/knowledge/reviews', async (request, reply) => {
    const body = request.body as any
    if (!body.packageId) {
      return reply.status(400).send({ success: false, error: 'packageId is required' })
    }

    const reviewers: string[] = body.reviewers || []
    const validation = opts.policyEngine.validateReviewers(reviewers, body.workspace || 'default')
    if (!validation.valid) {
      return reply.status(422).send({ success: false, error: validation.error })
    }

    try {
      const review = await opts.reviewEngine.createReview(
        body.packageId,
        reviewers,
        (request as any).user?.id || 'anonymous',
      )
      await opts.audit.record({
        packageId: body.packageId,
        type: 'review_started',
        actor: (request as any).user?.id || 'anonymous',
        payload: { reviewId: review.id, reviewers },
      })
      return { success: true, data: review }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── GET /knowledge/reviews — List reviews ──
  fastify.get('/api/knowledge/reviews', async (request) => {
    const query = request.query as any
    const reviews = await opts.reviewEngine.listReviews(query.packageId)
    return { success: true, data: reviews }
  })

  // ── GET /knowledge/reviews/:id — Get review ──
  fastify.get('/api/knowledge/reviews/:id', async (request, reply) => {
    const { id } = request.params as any
    const review = await opts.reviewEngine.getReview(id)
    if (!review) {
      return reply.status(404).send({ success: false, error: 'Review not found' })
    }
    return { success: true, data: review }
  })

  // ── POST /knowledge/reviews/:id/comment — Add comment ──
  fastify.post('/api/knowledge/reviews/:id/comment', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    if (!body.content) {
      return reply.status(400).send({ success: false, error: 'content is required' })
    }

    const review = await opts.reviewEngine.addComment(
      id,
      (request as any).user?.id || 'anonymous',
      body.content,
    )
    if (!review) {
      return reply.status(422).send({ success: false, error: 'Cannot comment on this review' })
    }
    await opts.audit.record({
      packageId: review.packageId,
      type: 'comment_added',
      actor: (request as any).user?.id || 'anonymous',
      payload: { reviewId: id, content: body.content },
    })
    return { success: true, data: review }
  })

  // ── POST /knowledge/reviews/:id/approve — Approve ──
  fastify.post('/api/knowledge/reviews/:id/approve', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    const result = await opts.approvalEngine.approve(
      id,
      (request as any).user?.id || 'anonymous',
      body.comment || 'Approved',
      body.publishTargets || [],
    )
    if (!result) {
      return reply.status(422).send({ success: false, error: 'Cannot approve this review' })
    }
    await opts.audit.record({
      packageId: result.packageId,
      type: 'approved',
      actor: (request as any).user?.id || 'anonymous',
      payload: { reviewId: id, publishTargets: body.publishTargets || [] },
    })
    return { success: true, data: result }
  })

  // ── POST /knowledge/reviews/:id/request-changes — Request changes ──
  fastify.post('/api/knowledge/reviews/:id/request-changes', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    if (!body.comment) {
      return reply.status(400).send({ success: false, error: 'comment is required for changes request' })
    }

    const result = await opts.approvalEngine.requestChanges(
      id,
      (request as any).user?.id || 'anonymous',
      body.comment,
    )
    if (!result) {
      return reply.status(422).send({ success: false, error: 'Cannot request changes on this review' })
    }
    await opts.audit.record({
      packageId: result.packageId,
      type: 'changes_requested',
      actor: (request as any).user?.id || 'anonymous',
      payload: { reviewId: id, comment: body.comment },
    })
    return { success: true, data: result }
  })

  // ── GET /knowledge/audit/:packageId — Get audit timeline ──
  fastify.get('/api/knowledge/audit/:packageId', async (request, reply) => {
    const { packageId } = request.params as any
    const events = await opts.audit.getEvents(packageId)
    return { success: true, data: events }
  })

  // ── GET /knowledge/audit — Get all audit events ──
  fastify.get('/api/knowledge/audit', async (request) => {
    const query = request.query as any
    const limit = query.limit ? parseInt(query.limit) : 100
    const events = await opts.audit.getAllEvents(limit)
    return { success: true, data: events }
  })

  // ── GET /knowledge/review/policies — Get policies ──
  fastify.get('/api/knowledge/review/policies', async (_request) => {
    return { success: true, data: { default: opts.policyEngine.getPolicy('default') } }
  })

  // ── PUT /knowledge/review/policies/:workspace — Set policy ──
  fastify.put('/api/knowledge/review/policies/:workspace', async (request, reply) => {
    const { workspace } = request.params as any
    const body = request.body as any
    opts.policyEngine.setPolicy(workspace, body)
    return { success: true, data: opts.policyEngine.getPolicy(workspace) }
  })
}
