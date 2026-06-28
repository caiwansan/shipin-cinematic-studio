// ============================================================
// Asset Routes — 资产管理
// ============================================================

import type { FastifyInstance } from 'fastify'
import { assetRepository } from '../../../services/platform/workspace/repositories/asset.repository.js'

export default async function assetRoutes(app: FastifyInstance) {
  // Create asset
  app.post('/api/platform/workspace/:workspaceId/asset', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { type, path, mimeType, size, hash, metadata } = req.body as any
    const asset = await assetRepository.create({
      workspaceId, type, path, mimeType, size, hash, metadata,
    })
    return reply.code(201).send(asset)
  })

  // List assets
  app.get('/api/platform/workspace/:workspaceId/asset', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { type } = req.query as any
    const assets = type
      ? await assetRepository.findByType(workspaceId, type)
      : await assetRepository.findByWorkspaceId(workspaceId)
    return reply.send(assets)
  })

  // Get asset by ID
  app.get('/api/platform/workspace/asset/:assetId', async (req, reply) => {
    const { assetId } = req.params as any
    const asset = await assetRepository.findById(assetId)
    if (!asset) return reply.code(404).send({ error: 'Asset not found' })
    return reply.send(asset)
  })

  // Delete asset
  app.delete('/api/platform/workspace/asset/:assetId', async (req, reply) => {
    const { assetId } = req.params as any
    await assetRepository.delete(assetId)
    return reply.code(204).send()
  })

  // Count assets
  app.get('/api/platform/workspace/:workspaceId/asset/count', async (req, reply) => {
    const { workspaceId } = req.params as any
    const count = await assetRepository.countByWorkspaceId(workspaceId)
    return reply.send({ count })
  })
}
