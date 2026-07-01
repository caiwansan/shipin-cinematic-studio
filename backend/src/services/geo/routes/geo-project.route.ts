// ============================================================
// GEO Project Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../services/geo-project.service'
import { geoPersistenceService } from '../services/geo-persistence.service'

export default async function geoProjectRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects — Create project
  fastify.post('/api/geo/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const user = request.user as any

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
  fastify.get('/api/geo/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const tenantId = user.id

    try {
      const projects = await geoProjectService.listProjects(tenantId)
      return { success: true, data: projects }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id — Get project
  fastify.get('/api/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.put('/api/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.delete('/api/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
  fastify.post('/api/geo/projects/:id/snapshot', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const snapshot = await geoProjectService.snapshotProject(id)
      return { success: true, data: snapshot }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/versions/:version — Get project version
  fastify.get('/api/geo/projects/:id/versions/:version', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

  // ════════════════════════════════════════════════════════════
  // P1-A: Persistence Layer — Report endpoints
  // ════════════════════════════════════════════════════════════

  // PUT /api/geo/projects/:id/discovery — Save discovery report
  fastify.put('/api/geo/projects/:id/discovery', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.entityName || !body.adi) {
      return reply.status(400).send({ success: false, error: 'entityName and adi are required' })
    }

    try {
      const report = await geoPersistenceService.saveDiscoveryReport(
        id,
        body.entityName,
        {
          adi: body.adi,
          coverageScore: body.coverageScore ?? 0,
          shareScore: body.shareScore ?? 0,
          positionScore: body.positionScore ?? 0,
          reportData: body.reportData ?? {},
        }
      )
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/discovery — Get latest discovery report
  fastify.get('/api/geo/projects/:id/discovery', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const report = await geoPersistenceService.getDiscoveryReport(id)
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id/action-plan — Save action plan
  fastify.put('/api/geo/projects/:id/action-plan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.planData) {
      return reply.status(400).send({ success: false, error: 'planData is required' })
    }

    try {
      const plan = await geoPersistenceService.saveActionPlan(
        id,
        body.planData,
        body.discoveryReportId
      )
      return { success: true, data: plan }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/action-plan — Get latest action plan
  fastify.get('/api/geo/projects/:id/action-plan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const plan = await geoPersistenceService.getActionPlan(id)
      return { success: true, data: plan }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id/verification — Save verification report
  fastify.put('/api/geo/projects/:id/verification', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.entityName || body.beforeAdi === undefined || body.afterAdi === undefined) {
      return reply.status(400).send({ success: false, error: 'entityName, beforeAdi, and afterAdi are required' })
    }

    try {
      const report = await geoPersistenceService.saveVerificationReport(
        id,
        body.entityName,
        {
          beforeAdi: body.beforeAdi,
          afterAdi: body.afterAdi,
          deltaAdi: body.afterAdi - body.beforeAdi,
          reportData: body.reportData ?? {},
        }
      )
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/verification — Get latest verification report
  fastify.get('/api/geo/projects/:id/verification', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const report = await geoPersistenceService.getVerificationReport(id)
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/history — Get project history
  fastify.get('/api/geo/projects/:id/history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const history = await geoPersistenceService.listHistory(id)
      return { success: true, data: history }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/dashboard — Get project dashboard (with all latest reports)
  fastify.get('/api/geo/projects/:id/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const dashboard = await geoProjectService.getProjectWithReport(id)
      if (!dashboard.project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: dashboard }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
