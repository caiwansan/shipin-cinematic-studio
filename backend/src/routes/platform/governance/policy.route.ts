// ============================================================
// Policy Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function policyRoute(app: FastifyInstance): Promise<void> {
  // Create policy
  app.post('/api/platform/governance/policies', async (req, reply) => {
    const data = req.body as any
    const policy = await governanceService.policy.createPolicy(data)
    return reply.code(201).send({ success: true, data: policy })
  })

  // Evaluate policy
  app.post('/api/platform/governance/policies/evaluate', async (req, reply) => {
    const { policyCode, context } = req.body as any
    const result = await governanceService.policy.evaluate(policyCode, context)
    return { success: true, data: result }
  })

  // Check all policies for tenant
  app.post('/api/platform/governance/policies/check', async (req, reply) => {
    const { tenantId, context } = req.body as any
    const results = await governanceService.policy.checkPolicies(tenantId, context)
    return { success: true, data: results }
  })

  // Get policy by code
  app.get('/api/platform/governance/policies/:code', async (req, reply) => {
    const { code } = req.params as any
    const { policyRepository } = await import('../../../services/platform/governance/repositories/policy.repository.js')
    const policy = await policyRepository.findByCode(code)
    if (!policy) return reply.code(404).send({ success: false, error: 'Policy not found' })
    return { success: true, data: policy }
  })

  // List policies for tenant
  app.get('/api/platform/governance/policies', async (req, reply) => {
    const { policyRepository } = await import('../../../services/platform/governance/repositories/policy.repository.js')
    const policies = await policyRepository.findGlobalPolicies()
    return { success: true, data: policies }
  })
}
