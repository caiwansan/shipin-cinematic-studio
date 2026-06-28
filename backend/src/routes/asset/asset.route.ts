// ============================================================
// Asset Routes — CRUD + list + search for Unified Assets
// API: /api/asset/*
// ============================================================

import { FastifyInstance } from 'fastify'
import { assetService } from '../../services/asset/asset.service.js'

export default async function assetRoutes(fastify: FastifyInstance) {
  // Create asset
  fastify.post('/api/asset', async (request, reply) => {
    const body = request.body as any
    if (!body.projectId || !body.type || !body.title) {
      return reply.status(400).send({ success: false, error: 'projectId, type, and title are required' })
    }
    const asset = await assetService.createAsset({
      projectId: body.projectId,
      type: body.type,
      title: body.title,
      language: body.language,
      source: body.source,
      sourceUrl: body.sourceUrl,
      content: body.content,
      summary: body.summary,
      metadata: body.metadata,
      status: body.status,
    })
    return { success: true, data: { asset } }
  })

  // Get asset by ID
  fastify.get('/api/asset/:id', async (request, reply) => {
    const { id } = request.params as any
    const asset = await assetService.getAsset(id)
    if (!asset) {
      return reply.status(404).send({ success: false, error: 'Asset not found' })
    }
    return { success: true, data: { asset } }
  })

  // List assets by project
  fastify.get('/api/asset/project/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const query = request.query as any
    const result = await assetService.listByProject(projectId, {
      type: query.type,
      status: query.status,
      source: query.source,
      tag: query.tag,
      search: query.search,
      language: query.language,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Search assets
  fastify.get('/api/asset/search', async (request, reply) => {
    const query = request.query as any
    const result = await assetService.search({
      search: query.q,
      type: query.type,
      status: query.status,
      projectId: query.projectId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Update asset
  fastify.put('/api/asset/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const asset = await assetService.updateAsset(id, {
      type: body.type,
      title: body.title,
      language: body.language,
      source: body.source,
      sourceUrl: body.sourceUrl,
      content: body.content,
      summary: body.summary,
      metadata: body.metadata,
      status: body.status,
    })
    if (!asset) {
      return reply.status(404).send({ success: false, error: 'Asset not found' })
    }
    return { success: true, data: { asset } }
  })

  // Delete asset (soft)
  fastify.delete('/api/asset/:id', async (request, reply) => {
    const { id } = request.params as any
    const result = await assetService.deleteAsset(id)
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Asset not found' })
    }
    return { success: true, data: result }
  })

  // Get project asset stats
  fastify.get('/api/asset/stats/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const stats = await assetService.getProjectStats(projectId)
    return { success: true, data: { stats } }
  })

  // Add tag to asset
  fastify.post('/api/asset/:id/tags', async (request, reply) => {
    const { id } = request.params as any
    const { tag } = request.body as any
    if (!tag) {
      return reply.status(400).send({ success: false, error: 'tag is required' })
    }
    const result = await assetService.addTag(id, tag)
    return { success: true, data: { tag: result } }
  })

  // Remove tag from asset
  fastify.delete('/api/asset/:id/tags/:tag', async (request, reply) => {
    const { id, tag } = request.params as any
    await assetService.removeTag(id, tag)
    return { success: true }
  })

  // Create relation between assets
  fastify.post('/api/asset/relation', async (request, reply) => {
    const { fromAssetId, toAssetId, relation } = request.body as any
    if (!fromAssetId || !toAssetId || !relation) {
      return reply.status(400).send({ success: false, error: 'fromAssetId, toAssetId, and relation are required' })
    }
    const edge = await assetService.createRelation(fromAssetId, toAssetId, relation)
    return { success: true, data: { relation: edge } }
  })

  // Get relations for an asset
  fastify.get('/api/asset/:id/relations', async (request, reply) => {
    const { id } = request.params as any
    const relations = await assetService.getRelations(id)
    return { success: true, data: { relations } }
  })
}
