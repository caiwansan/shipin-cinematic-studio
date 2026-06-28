// ============================================================
// Brand GEO — Scanner Routes
// API: /api/geo/scan, /api/geo/scan/:projectId/status, /api/geo/snapshot/:projectId
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoSnipperService } from '../../services/geo/snapshot.service.js'

export default async function geoScannerRoutes(fastify: FastifyInstance) {
  // Trigger scan
  fastify.post('/api/geo/scan', async (request, reply) => {
    const { projectId, url } = request.body as any
    if (!projectId || !url) {
      return reply.status(400).send({ success: false, error: 'projectId and url are required' })
    }
    const snapshot = await geoSnipperService.startScan(projectId, url)
    return { success: true, data: { snapshot } }
  })

  // Get scan status
  fastify.get('/api/geo/scan/:projectId/status', async (request, reply) => {
    const { projectId } = request.params as any
    const status = await geoSnipperService.getScanStatus(projectId)
    return { success: true, data: { status } }
  })

  // Get snapshot
  fastify.get('/api/geo/snapshot/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const snapshot = await geoSnipperService.getByProjectId(projectId)
    if (!snapshot) {
      return reply.status(404).send({ success: false, error: 'Snapshot not found' })
    }
    return { success: true, data: { snapshot } }
  })
}
