// ════════════════════════════════════════════════════════════
// P3 API Route: Publishing Plane — thin transport layer
// ════════════════════════════════════════════════════════════
// Route only: validates input, delegates to Service, formats response.
// No business logic. No Prisma. No Adapter knowledge.

import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { ClaimService } from './claim.service'
import { PlanService } from './plan.service'
import { RecorderService } from './recorder.service'
import { channelRegistry } from './artifact-renderer'
import type { CreateClaimDTO, CreatePlanDTO, PlanStatus } from './types'

const prisma = new PrismaClient()
const claimSvc = new ClaimService(prisma)
const planSvc = new PlanService(prisma)
const recorderSvc = new RecorderService(prisma)

export default async function publishingRoutes(fastify: FastifyInstance) {
  // ── Plans ──

  // GET /api/geo/publish/plans/:projectId — list plans for a project
  fastify.get('/api/geo/publish/plans/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const plans = await planSvc.listByProject(projectId)
    return { success: true, data: plans }
  })

  // GET /api/geo/publish/summary/:projectId — publishing summary
  fastify.get('/api/geo/publish/summary/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const summary = await recorderSvc.getSummary(projectId)
    return { success: true, data: summary }
  })

  // GET /api/geo/publish/plan/:planId — single plan with claims
  fastify.get('/api/geo/publish/plan/:planId', async (req, reply) => {
    const { planId } = req.params as { planId: string }
    const plan = await planSvc.getById(planId)
    if (!plan) return reply.status(404).send({ success: false, error: 'Plan not found' })
    return { success: true, data: plan }
  })

  // POST /api/geo/publish/plan — create a new plan
  fastify.post<{ Body: CreatePlanDTO & { projectId: string } }>('/api/geo/publish/plan', async (req, reply) => {
    const { projectId, title, claimIds, targetChannels, executionOrder } = req.body
    if (!projectId || !title || !claimIds?.length) {
      return reply.status(400).send({ success: false, error: 'Missing required fields: projectId, title, claimIds' })
    }
    const plan = await planSvc.create({ projectId, title, claimIds, targetChannels, executionOrder })
    return { success: true, data: plan }
  })

  // PATCH /api/geo/publish/plan/:planId/status — transition plan status
  fastify.patch<{ Body: { status: PlanStatus } }>('/api/geo/publish/plan/:planId/status', async (req, reply) => {
    const { planId } = req.params as { planId: string }
    const { status } = req.body
    if (!status) return reply.status(400).send({ success: false, error: 'status required' })
    const plan = await planSvc.updateStatus(planId, status)
    return { success: true, data: plan }
  })

  // POST /api/geo/publish/plan/:planId/publish — approve and publish
  fastify.post('/api/geo/publish/plan/:planId/publish', async (req, reply) => {
    const { planId } = req.params as { planId: string }
    const plan = await planSvc.getById(planId)
    if (!plan) return reply.status(404).send({ success: false, error: 'Plan not found' })

    // Get all claims and render + record for each channel
    const claims = await claimSvc.listByProject(plan.projectId)
    const planClaims = claims.filter(c => plan.claimIds.includes(c.id))

    const results: Array<{ claimId: string; channel: string; recordId: string }> = []
    for (const claim of planClaims) {
      for (const channel of (plan.targetChannels || ['markdown'])) {
        try {
          const adapter = channelRegistry.resolve(channel)
          const artifact = adapter.render(claim)
          const record = await recorderSvc.record(planId, claim.id, channel, claim.version, artifact)
          await recorderSvc.confirmPublished(record.id)
          results.push({ claimId: claim.id, channel, recordId: record.id })
        } catch {
          // Skip channels that fail to render
        }
      }
    }

    // Update plan status to published
    await planSvc.updateStatus(planId, 'published' as PlanStatus)

    return { success: true, data: { planId, results } }
  })

  // POST /api/geo/publish/plan/:planId/export — export all artifacts
  fastify.post('/api/geo/publish/plan/:planId/export', async (req, reply) => {
    const { planId } = req.params as { planId: string }
    const plan = await planSvc.getById(planId)
    if (!plan) return reply.status(404).send({ success: false, error: 'Plan not found' })

    const records = await recorderSvc.listByPlan(planId)
    return { success: true, data: { records } }
  })

  // ── Claims ──

  // GET /api/geo/publish/claims/:projectId — list claims for a project
  fastify.get('/api/geo/publish/claims/:projectId', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const claims = await claimSvc.listByProject(projectId)
    return { success: true, data: claims }
  })

  // POST /api/geo/publish/claim — create a new claim
  fastify.post<{ Body: CreateClaimDTO }>('/api/geo/publish/claim', async (req, reply) => {
    const claim = await claimSvc.create(req.body)
    return { success: true, data: claim }
  })

  // ── Preview ──

  // POST /api/geo/publish/preview/:claimId — render preview for a channel
  fastify.post<{ Body: { channel: string } }>('/api/geo/publish/preview/:claimId', async (req, reply) => {
    const { claimId } = req.params as { claimId: string }
    const { channel } = req.body
    if (!channel) return reply.status(400).send({ success: false, error: 'channel required' })

    const claim = await claimSvc.getById(claimId)
    if (!claim) return reply.status(404).send({ success: false, error: 'Claim not found' })

    const adapter = channelRegistry.resolve(channel)
    const artifact = adapter.render(claim)
    return { success: true, data: { content: artifact.preview || artifact.content, format: artifact.format } }
  })

  // ── Records (History) ──

  // GET /api/geo/publish/records/plan/:planId — publish records for a plan
  fastify.get('/api/geo/publish/records/plan/:planId', async (req, reply) => {
    const { planId } = req.params as { planId: string }
    const records = await recorderSvc.listByPlan(planId)
    return { success: true, data: records }
  })

  // GET /api/geo/publish/records/claim/:claimId — publish records for a claim
  fastify.get('/api/geo/publish/records/claim/:claimId', async (req, reply) => {
    const { claimId } = req.params as { claimId: string }
    const records = await recorderSvc.listByClaim(claimId)
    return { success: true, data: records }
  })
}

export const geoPublishingRoutes = publishingRoutes
