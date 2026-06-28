// ============================================================
// GEO Project Routes (Brand GEO compat → KMKI-GEO Sprint 1A)
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../../services/geo/services/geo-project.service'

export default async function geoProjectRoutes(fastify: FastifyInstance) {
  // GET /api/geo/projects — List projects
  fastify.get('/api/geo/projects', async (request, reply) => {
    const userId = (request as any).user?.id || (request.query as any).userId || 'anonymous'
    try {
      const projects = await geoProjectService.listProjects(userId)
      return { success: true, data: { projects } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects — Create project
  fastify.post('/api/geo/projects', async (request, reply) => {
    const userId = (request as any).user?.id || 'anonymous'
    const body = request.body as any
    if (!body?.name) {
      return reply.status(400).send({ success: false, error: 'name is required' })
    }
    try {
      const project = await geoProjectService.createProject({
        name: body.name,
        topic: body.topic,
        userId,
        language: body.language,
        industry: body.industry,
        config: body.config,
      })
      return reply.status(201).send({ success: true, data: { project } })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id — Get project
  fastify.get('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    try {
      const project = await geoProjectService.getProject(id)
      if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })
      return { success: true, data: { project } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id — Update project
  fastify.put('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    try {
      const project = await geoProjectService.updateProject(id, body)
      if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })
      return { success: true, data: { project } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/projects/:id — Delete project
  fastify.delete('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any
    try {
      const deleted = await geoProjectService.deleteProject(id)
      if (!deleted) return reply.status(404).send({ success: false, error: 'Project not found' })
      return { success: true }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
