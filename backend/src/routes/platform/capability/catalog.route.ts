// ============================================================
// Catalog Routes — Search and discover capabilities
// API: /api/capability/catalog/*
// ============================================================

import { capabilityCatalogService } from '../../../services/platform/capability/capability-catalog.service.js'

export default async function catalogRoutes(fastify: any) {
  // Search capabilities
  fastify.get('/api/capability/catalog/search', async (request: any, reply: any) => {
    const query = request.query as any
    const result = await capabilityCatalogService.search({
      query: query.query,
      category: query.category,
      tags: query.tags ? query.tags.split(',') : undefined,
      status: query.status,
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    })
    return { success: true, data: result }
  })

  // Browse by category
  fastify.get('/api/capability/catalog/category/:category', async (request: any, reply: any) => {
    const { category } = request.params
    const items = await capabilityCatalogService.browseByCategory(category)
    return { success: true, data: { items, total: items.length } }
  })

  // Get all categories
  fastify.get('/api/capability/catalog/categories', async (request: any, reply: any) => {
    const categories = await capabilityCatalogService.getCategories()
    return { success: true, data: categories }
  })

  // Quick search
  fastify.get('/api/capability/catalog/quick', async (request: any, reply: any) => {
    const query = request.query as any
    if (!query.query) {
      return reply.status(400).send({ success: false, error: 'query parameter is required' })
    }
    const items = await capabilityCatalogService.quickSearch(query.query)
    return { success: true, data: { items, total: items.length } }
  })

  // Get version history
  fastify.get('/api/capability/catalog/:name/versions', async (request: any, reply: any) => {
    const { name } = request.params
    const items = await capabilityCatalogService.getVersionHistory(name)
    return { success: true, data: { items, total: items.length } }
  })
}
