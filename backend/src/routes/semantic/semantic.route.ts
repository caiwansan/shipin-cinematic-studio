// ============================================================
// Semantic Routes — Pipeline trigger + stats
// API: /api/semantic/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'
import { semanticRuntime } from '../../services/semantic/runtime/semantic.runtime.js'

export default async function semanticRoutes(fastify: any) {
  // Extract from content (pipeline trigger)
  fastify.post('/api/semantic/extract', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.content) {
      return reply.status(400).send({ success: false, error: 'projectId and content are required' })
    }

    const result = await semanticRuntime.load(body.projectId, {
      content: body.content,
      sourceUrl: body.sourceUrl,
      metadata: { assetId: body.assetId, ...(body.metadata || {}) },
    })

    return { success: true, data: result }
  })

  // Extract from asset (by asset ID)
  fastify.post('/api/semantic/extract/:assetId', async (request: any, reply: any) => {
    const { assetId } = request.params
    const body = request.body as any
    if (!body.projectId) {
      return reply.status(400).send({ success: false, error: 'projectId is required' })
    }

    // Get asset content
    const { prisma } = await import('../../utils/index.js')
    const asset = await prisma.unifiedAsset.findUnique({ where: { id: assetId } })
    if (!asset) {
      return reply.status(404).send({ success: false, error: 'Asset not found' })
    }

    const result = await semanticRuntime.load(body.projectId, {
      content: asset.content || asset.summary || '',
      sourceUrl: asset.sourceUrl || undefined,
      metadata: { assetId: asset.id, type: asset.type, title: asset.title },
    })

    return { success: true, data: result }
  })

  // Rebuild semantic data for a project
  fastify.post('/api/semantic/rebuild/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const result = await semanticRuntime.rebuild(projectId)
    return { success: true, data: result }
  })

  // Get project semantic stats
  fastify.get('/api/semantic/stats/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const stats = await semanticRuntime.stats(projectId)
    return { success: true, data: { stats } }
  })

  // Get runtime version
  fastify.get('/api/semantic/version', async (_request: any, _reply: any) => {
    return { success: true, data: { version: semanticRuntime.getVersion() } }
  })
}
