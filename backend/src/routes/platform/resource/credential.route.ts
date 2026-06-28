// ============================================================
// Credential Routes — credential management
// API: /api/resource/credential/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'

export default async function credentialRoutes(fastify: any) {
  // List credentials for tenant
  fastify.get('/api/resource/credential', async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = query.tenantId || request.user?.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })
    const credentials = await resourceService.listCredentials(tenantId, query.resourceId)
    return { success: true, data: credentials }
  })

  // Store credential
  fastify.post('/api/resource/credential', async (request: any, reply: any) => {
    const body = request.body as any
    const tenantId = body.tenantId || request.user?.tenantId
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })
    if (!body.resourceId) return reply.status(400).send({ success: false, error: 'resourceId is required' })
    if (!body.apiKey) return reply.status(400).send({ success: false, error: 'apiKey is required' })

    try {
      const credential = await resourceService.storeCredential({
        resourceId: body.resourceId,
        tenantId,
        workspaceId: body.workspaceId,
        name: body.name || `${body.resourceId}-key`,
        apiKey: body.apiKey,
        endpoint: body.endpoint,
        models: body.models ? JSON.stringify(body.models) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      })
      return reply.status(201).send({ success: true, data: credential })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Delete credential
  fastify.delete('/api/resource/credential/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await resourceService.deleteCredential(id)
    return { success: true, message: 'Credential deleted' }
  })

  // Rotate credential
  fastify.post('/api/resource/credential/:id/rotate', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    if (!body.newApiKey) return reply.status(400).send({ success: false, error: 'newApiKey is required' })
    const credential = await resourceService.rotateCredential(id, body.newApiKey)
    return { success: true, data: credential }
  })
}
