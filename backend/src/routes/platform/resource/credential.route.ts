// ============================================================
// Credential Routes — credential management
// API: /api/resource/credential/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'
import { prisma } from '../../../utils/index.js'

export default async function credentialRoutes(fastify: any) {
  // ─── Helper: resolve tenantId from request ───
  // Priority: query/body > JWT user's personal tenant
  async function resolveTenantId(request: any): Promise<string | null> {
    const queryOrBody = request.body?.tenantId || request.query?.tenantId
    if (queryOrBody) return queryOrBody
    if (request.user?.tenantId) return request.user?.tenantId
    // Fallback: resolve personal tenant from user id
    if (request.user?.id) {
      try {
        const tenant = await prisma.tenant.findFirst({
          where: { name: `Personal: ${request.user.id}`, type: 'personal', status: 'active' },
          select: { id: true },
        })
        return tenant?.id || null
      } catch (e) {
        console.warn('[credential] Failed to resolve tenantId from user:', (e as Error)?.message)
      }
    }
    return null
  }

  // List credentials for tenant
  fastify.get('/api/resource/credential', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const query = request.query as any
    const tenantId = await resolveTenantId(request)
    if (!tenantId) return reply.status(400).send({ success: false, error: 'tenantId is required' })
    const credentials = await resourceService.listCredentials(tenantId, query.resourceId)
    return { success: true, data: credentials }
  })

  // Store credential
  fastify.post('/api/resource/credential', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const body = request.body as any
    const tenantId = await resolveTenantId(request)
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
