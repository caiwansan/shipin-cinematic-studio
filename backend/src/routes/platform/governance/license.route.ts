// ============================================================
// License Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function licenseRoute(app: FastifyInstance): Promise<void> {
  // Create license
  app.post('/api/platform/governance/licenses', async (req, reply) => {
    const data = req.body as any
    const license = await governanceService.licenses.create(data)
    return reply.code(201).send({ success: true, data: license })
  })

  // Get licenses for tenant
  app.get('/api/platform/governance/licenses/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const licenses = await governanceService.licenses.findByTenant(tenantId)
    return { success: true, data: licenses }
  })

  // Get license by key
  app.get('/api/platform/governance/licenses/key/:licenseKey', async (req, reply) => {
    const { licenseKey } = req.params as any
    const license = await governanceService.licenses.findByKey(licenseKey)
    if (!license) return reply.code(404).send({ success: false, error: 'License not found' })
    return { success: true, data: license }
  })

  // Update license
  app.put('/api/platform/governance/licenses/:id', async (req, reply) => {
    const { id } = req.params as any
    const data = req.body as any
    const license = await governanceService.licenses.update(id, data)
    return { success: true, data: license }
  })
}
