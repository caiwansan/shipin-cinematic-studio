// ============================================================
// Manifest Routes — Manifest 导出/导入
// ============================================================

import type { FastifyInstance } from 'fastify'
import { workspaceService } from '../../../services/platform/workspace/workspace.service.js'

export default async function manifestRoutes(app: FastifyInstance) {
  // Get manifest
  app.get('/api/platform/workspace/:workspaceId/manifest', async (req, reply) => {
    const { workspaceId } = req.params as any
    const manifest = await workspaceService.getManifest(workspaceId)
    if (!manifest) return reply.code(404).send({ error: 'Manifest not found' })
    return reply.send(manifest)
  })

  // Generate manifest (force regenerate)
  app.post('/api/platform/workspace/:workspaceId/manifest/generate', async (req, reply) => {
    const { workspaceId } = req.params as any
    const manifest = await workspaceService.getManifest(workspaceId)
    return reply.send(manifest)
  })

  // Export workspace
  app.get('/api/platform/workspace/:workspaceId/export', async (req, reply) => {
    const { workspaceId } = req.params as any
    const bundle = await workspaceService.exportWorkspace(workspaceId)
    return reply.send(bundle)
  })

  // Import workspace
  app.post('/api/platform/workspace/import', async (req, reply) => {
    const { tenantId, manifest, data } = req.body as any
    const result = await workspaceService.importWorkspace(tenantId, manifest, data)
    return reply.code(201).send(result)
  })
}
