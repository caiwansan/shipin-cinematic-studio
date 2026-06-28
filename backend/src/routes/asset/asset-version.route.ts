// ============================================================
// Asset Version Routes — version management
// API: /api/asset/:assetId/versions/*
// ============================================================

import { FastifyInstance } from 'fastify'
import { assetVersionService } from '../../services/asset/asset-version.service.js'
import { assetService } from '../../services/asset/asset.service.js'

export default async function assetVersionRoutes(fastify: FastifyInstance) {
  // List versions
  fastify.get('/api/asset/:assetId/versions', async (request, reply) => {
    const { assetId } = request.params as any
    const versions = await assetVersionService.listVersions(assetId)
    return { success: true, data: { versions } }
  })

  // Get specific version
  fastify.get('/api/asset/:assetId/versions/:version', async (request, reply) => {
    const { assetId, version } = request.params as any
    const v = await assetVersionService.getVersion(assetId, parseInt(version))
    if (!v) {
      return reply.status(404).send({ success: false, error: 'Version not found' })
    }
    return { success: true, data: { version: v } }
  })

  // Restore version
  fastify.post('/api/asset/:assetId/versions/:version/restore', async (request, reply) => {
    const { assetId, version } = request.params as any
    const asset = await assetVersionService.restoreVersion(assetId, parseInt(version))
    if (!asset) {
      return reply.status(404).send({ success: false, error: 'Version not found' })
    }
    return { success: true, data: { asset } }
  })
}
