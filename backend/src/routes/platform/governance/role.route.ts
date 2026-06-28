// ============================================================
// Role Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function roleRoute(app: FastifyInstance): Promise<void> {
  // Create role
  app.post('/api/platform/governance/roles', async (req, reply) => {
    const data = req.body as any
    const role = await governanceService.role.createRole(data, (req as any).userId)
    return reply.code(201).send({ success: true, data: role })
  })

  // List roles for tenant
  app.get('/api/platform/governance/roles/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const roles = await governanceService.role.getRoles(tenantId)
    return { success: true, data: roles }
  })

  // Assign role to user
  app.post('/api/platform/governance/roles/assign', async (req, reply) => {
    const { userId, roleId, tenantId } = req.body as any
    await governanceService.role.assignRole(userId, roleId, tenantId, (req as any).userId)
    return { success: true }
  })

  // Get user capabilities
  app.get('/api/platform/governance/roles/user-capabilities/:userId', async (req, reply) => {
    const { userId } = req.params as any
    const capabilities = await governanceService.role.getUserCapabilities(userId)
    return { success: true, data: { userId, capabilities } }
  })

  // Update role
  app.put('/api/platform/governance/roles/:id', async (req, reply) => {
    const { id } = req.params as any
    const data = req.body as any
    const role = await governanceService.role.updateRole(id, data)
    return { success: true, data: role }
  })

  // Delete role
  app.delete('/api/platform/governance/roles/:id', async (req, reply) => {
    const { id } = req.params as any
    await governanceService.role.deleteRole(id)
    return { success: true }
  })
}
