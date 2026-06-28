// ============================================================
// Brand GEO — Project Routes
// CRUD: /api/geo/projects
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../../services/geo/project.service.js'

export default async function geoProjectRoutes(fastify: FastifyInstance) {
  // Get user's project list
  fastify.get('/api/geo/projects', async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    const projects = await geoProjectService.list(userId)
    return { success: true, data: { projects } }
  })

  // Create project
  fastify.post('/api/geo/projects', async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    const { name, website, industry, language, country } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, error: 'Project name is required' })
    }
    const project = await geoProjectService.create({
      userId,
      name,
      website,
      industry,
      language,
      country,
    })
    return { success: true, data: { project } }
  })

  // Get project detail
  fastify.get('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    const project = await geoProjectService.getById(id)
    if (!project) {
      return reply.status(404).send({ success: false, error: 'Project not found' })
    }
    return { success: true, data: { project } }
  })

  // Update project
  fastify.put('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    const updates = request.body as any
    const project = await geoProjectService.update(id, updates)
    return { success: true, data: { project } }
  })

  // Delete project
  fastify.delete('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    await geoProjectService.delete(id)
    return { success: true, data: { message: 'Project deleted' } }
  })
}
