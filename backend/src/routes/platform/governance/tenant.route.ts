// ============================================================
// Tenant Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function tenantRoute(app: FastifyInstance): Promise<void> {
  // Create tenant
  app.post('/api/platform/governance/tenants', async (req, reply) => {
    const { name, type, metadata } = req.body as any
    const tenant = await governanceService.tenant.createTenant({ name, type, metadata }, (req as any).userId)
    return reply.code(201).send({ success: true, data: tenant })
  })

  // Get tenant by ID
  app.get('/api/platform/governance/tenants/:id', async (req, reply) => {
    const { id } = req.params as any
    const tenant = await governanceService.tenant.getTenant(id)
    if (!tenant) return reply.code(404).send({ success: false, error: 'Tenant not found' })
    return { success: true, data: tenant }
  })

  // List all tenants
  app.get('/api/platform/governance/tenants', async (req, reply) => {
    const tenants = await governanceService.tenant.listTenants()
    return { success: true, data: tenants }
  })

  // Activate tenant
  app.post('/api/platform/governance/tenants/:id/activate', async (req, reply) => {
    const { id } = req.params as any
    const tenant = await governanceService.tenant.activateTenant(id, (req as any).userId)
    return { success: true, data: tenant }
  })

  // Deactivate tenant
  app.post('/api/platform/governance/tenants/:id/deactivate', async (req, reply) => {
    const { id } = req.params as any
    const tenant = await governanceService.tenant.deactivateTenant(id, (req as any).userId)
    return { success: true, data: tenant }
  })

  // Delete tenant
  app.delete('/api/platform/governance/tenants/:id', async (req, reply) => {
    const { id } = req.params as any
    await governanceService.tenant.deleteTenant(id)
    return { success: true }
  })
}
