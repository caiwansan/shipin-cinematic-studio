// ============================================================
// Organization Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function organizationRoute(app: FastifyInstance): Promise<void> {
  // Create organization
  app.post('/api/platform/governance/organizations', async (req, reply) => {
    const { tenantId, name, type, parentId } = req.body as any
    const org = await governanceService.organization.createOrg(tenantId, name, type, parentId, (req as any).userId)
    return reply.code(201).send({ success: true, data: org })
  })

  // Get organization tree
  app.get('/api/platform/governance/organizations/:id/tree', async (req, reply) => {
    const { id } = req.params as any
    const tree = await governanceService.organization.getOrgTree(id)
    return { success: true, data: tree }
  })

  // Get organization
  app.get('/api/platform/governance/organizations/:id', async (req, reply) => {
    const { id } = req.params as any
    const org = await governanceService.organization.getOrg(id)
    if (!org) return reply.code(404).send({ success: false, error: 'Organization not found' })
    return { success: true, data: org }
  })

  // Update organization
  app.put('/api/platform/governance/organizations/:id', async (req, reply) => {
    const { id } = req.params as any
    const data = req.body as any
    const org = await governanceService.organization.updateOrg(id, data)
    return { success: true, data: org }
  })

  // Delete organization
  app.delete('/api/platform/governance/organizations/:id', async (req, reply) => {
    const { id } = req.params as any
    await governanceService.organization.deleteOrg(id)
    return { success: true }
  })
}
