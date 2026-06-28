// ============================================================
// Taxonomy Routes — CRUD + tree query for SemanticTaxonomy
// API: /api/semantic/taxonomy/*
// ============================================================

import { semanticService } from '../../services/semantic/semantic.service.js'

export default async function taxonomyRoutes(fastify: any) {
  // Create taxonomy node
  fastify.post('/api/semantic/taxonomy', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.projectId || !body.name) {
      return reply.status(400).send({ success: false, error: 'projectId and name are required' })
    }
    const node = await semanticService.createTaxonomyNode({
      projectId: body.projectId,
      name: body.name,
      parentId: body.parentId,
      description: body.description,
      path: body.path,
      metadata: body.metadata,
    })
    return { success: true, data: { taxonomy: node } }
  })

  // Get taxonomy node by ID
  fastify.get('/api/semantic/taxonomy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const node = await semanticService.getTaxonomyNode(id)
    if (!node) {
      return reply.status(404).send({ success: false, error: 'Taxonomy node not found' })
    }
    return { success: true, data: { taxonomy: node } }
  })

  // List taxonomy by project
  fastify.get('/api/semantic/taxonomy/project/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const query = request.query as any
    const result = await semanticService.listTaxonomy({
      projectId,
      search: query.search,
      name: query.name,
      parentId: query.parentId || query.parentId === '' ? null : query.parentId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    })
    return { success: true, data: result }
  })

  // Get full taxonomy tree
  fastify.get('/api/semantic/taxonomy/tree/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const tree = await semanticService.getTaxonomyTree(projectId)
    return { success: true, data: { tree } }
  })

  // Get root nodes
  fastify.get('/api/semantic/taxonomy/roots/:projectId', async (request: any, reply: any) => {
    const { projectId } = request.params
    const roots = await semanticService.getTaxonomyRoots(projectId)
    return { success: true, data: { roots } }
  })

  // Get children of a node
  fastify.get('/api/semantic/taxonomy/:id/children', async (request: any, reply: any) => {
    const { id } = request.params
    const children = await semanticService.getTaxonomyChildren(id)
    return { success: true, data: { children } }
  })

  // Update taxonomy node
  fastify.put('/api/semantic/taxonomy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    const body = request.body as any
    const node = await semanticService.updateTaxonomyNode(id, {
      name: body.name,
      description: body.description,
      metadata: body.metadata,
      projectId: body.projectId,
    })
    if (!node) {
      return reply.status(404).send({ success: false, error: 'Taxonomy node not found' })
    }
    return { success: true, data: { taxonomy: node } }
  })

  // Delete taxonomy node
  fastify.delete('/api/semantic/taxonomy/:id', async (request: any, reply: any) => {
    const { id } = request.params
    await semanticService.deleteTaxonomyNode(id)
    return { success: true }
  })
}
