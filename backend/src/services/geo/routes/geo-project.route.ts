// ============================================================
// GEO Project Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../services/geo-project.service'

export default async function geoProjectRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects — Create project
  fastify.post('/api/geo/projects', async (request, reply) => {
    const body = request.body as any
    const user = (request as any).user || { id: body.userId || 'anonymous' }

    if (!body.name) {
      return reply.status(400).send({ success: false, error: 'name is required' })
    }

    try {
      const project = await geoProjectService.createProject({
        name: body.name,
        topic: body.topic,
        userId: user.id,
        language: body.language,
        industry: body.industry,
        config: body.config,
      })
      return reply.status(201).send({ success: true, data: project })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects — List projects
  fastify.get('/api/geo/projects', async (request, reply) => {
    const user = (request as any).user || { id: (request.query as any).userId || '' }
    const tenantId = (request.query as any).tenantId || user.id

    if (!tenantId) {
      return reply.status(400).send({ success: false, error: 'tenantId is required' })
    }

    try {
      const projects = await geoProjectService.listProjects(tenantId)
      return { success: true, data: projects }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id — Get project
  fastify.get('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await geoProjectService.getProject(id)
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: project }
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
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: project }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/projects/:id — Soft delete project
  fastify.delete('/api/geo/projects/:id', async (request, reply) => {
    const { id } = request.params as any

    try {
      const deleted = await geoProjectService.deleteProject(id)
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/snapshot — Snapshot project
  fastify.post('/api/geo/projects/:id/snapshot', async (request, reply) => {
    const { id } = request.params as any

    try {
      const snapshot = await geoProjectService.snapshotProject(id)
      return { success: true, data: snapshot }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/versions/:version — Get project version
  fastify.get('/api/geo/projects/:id/versions/:version', async (request, reply) => {
    const { id, version } = request.params as any

    try {
      const projectVersion = await geoProjectService.getProjectVersion(id, parseInt(version))
      if (!projectVersion) {
        return reply.status(404).send({ success: false, error: 'Version not found' })
      }
      return { success: true, data: projectVersion }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
