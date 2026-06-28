// ============================================================
// Resource Main Routes — aggregated resource management endpoints
// API: /api/resource/*
// ============================================================

import { resourceService } from '../../../services/platform/resource/resource.service.js'
import { resourceCatalogService } from '../../../services/platform/resource/resource-catalog.service.js'

export default async function resourceMainRoutes(fastify: any) {
  // Get catalog
  fastify.get('/api/resource/catalog', async (request: any, reply: any) => {
    const query = request.query as any
    const catalog = await resourceCatalogService.getCatalog({
      status: query.status,
      search: query.search,
    })
    return { success: true, data: catalog }
  })

  // Get resource types
  fastify.get('/api/resource/types', async (request: any, reply: any) => {
    const types = await resourceCatalogService.getResourceTypes()
    return { success: true, data: types }
  })

  // Search resources
  fastify.get('/api/resource/search', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.q) return reply.status(400).send({ success: false, error: 'q (search query) is required' })
    const results = await resourceCatalogService.search(query.q)
    return { success: true, data: results }
  })

  // Get catalog item
  fastify.get('/api/resource/catalog/:resourceId', async (request: any, reply: any) => {
    const { resourceId } = request.params
    const item = await resourceCatalogService.getCatalogItem(resourceId)
    if (!item) return reply.status(404).send({ success: false, error: 'Resource not found' })
    return { success: true, data: item }
  })
}
