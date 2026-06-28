// ============================================================
// Matrix Routes — Capability Matrix management
// API: /api/resource/matrix/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function matrixRoutes(fastify: any) {
  // Map capability to resource
  fastify.post('/api/resource/matrix', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.resourceId || !body.capabilityId) {
      return reply.status(400).send({ success: false, error: 'resourceId and capabilityId are required' })
    }
    try {
      const result = await resourceService.mapCapability(body)
      return reply.status(201).send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Batch map capabilities
  fastify.post('/api/resource/matrix/batch', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.resourceId || !body.mappings) {
      return reply.status(400).send({ success: false, error: 'resourceId and mappings are required' })
    }
    const results = await resourceService.batchMapCapabilities(body.resourceId, body.mappings)
    return { success: true, data: results }
  })

  // Get resource capabilities
  fastify.get('/api/resource/matrix/resource/:resourceId', async (request: any, reply: any) => {
    const { resourceId } = request.params
    const entries = await resourceService.getResourceCapabilities(resourceId)
    return { success: true, data: entries }
  })

  // Get capability resources
  fastify.get('/api/resource/matrix/capability/:capabilityId', async (request: any, reply: any) => {
    const { capabilityId } = request.params
    const entries = await resourceService.getCapabilityResources(capabilityId)
    return { success: true, data: entries }
  })

  // Get capability → resource map
  fastify.get('/api/resource/matrix/map', async (request: any, reply: any) => {
    const map = await resourceService.getCapabilityResourceMap()
    return { success: true, data: map }
  })

  // Unmap capability
  fastify.delete('/api/resource/matrix/:resourceId/:capabilityId', async (request: any, reply: any) => {
    const { resourceId, capabilityId } = request.params
    await resourceService.unmapCapability(resourceId, capabilityId)
    return { success: true, message: 'Capability unmapped' }
  })

  // Validate matrix
  fastify.get('/api/resource/matrix/validate', async (request: any, reply: any) => {
    const result = await resourceService.validateMatrix()
    return { success: true, data: result }
  })
}
