// ============================================================
// Workspace Routes — CRUD
// ============================================================

import type { FastifyInstance } from 'fastify'
import { workspaceService } from '../../../services/platform/workspace/workspace.service.js'

export default async function workspaceRoutes(app: FastifyInstance) {
  // Create workspace
  app.post('/api/platform/workspace', async (req, reply) => {
    const { type, tenantId, name, description, settings, metadata } = req.body as any
    const workspace = await workspaceService.create({ type, tenantId, name, description, settings, metadata })
    return reply.code(201).send(workspace)
  })

  // List workspaces
  app.get('/api/platform/workspace', async (req, reply) => {
    const { type, status, tenantId, search } = req.query as any
    const workspaces = await workspaceService.list({ type, status, tenantId, search })
    return reply.send(workspaces)
  })

  // Get workspace by ID
  app.get('/api/platform/workspace/:id', async (req, reply) => {
    const { id } = req.params as any
    const workspace = await workspaceService.get(id)
    if (!workspace) return reply.code(404).send({ error: 'Workspace not found' })
    return reply.send(workspace)
  })

  // Update workspace
  app.patch('/api/platform/workspace/:id', async (req, reply) => {
    const { id } = req.params as any
    const body = req.body as any
    const workspace = await workspaceService.update(id, body)
    return reply.send(workspace)
  })

  // Delete workspace
  app.delete('/api/platform/workspace/:id', async (req, reply) => {
    const { id } = req.params as any
    await workspaceService.delete(id)
    return reply.code(204).send()
  })

  // Open workspace
  app.post('/api/platform/workspace/:id/open', async (req, reply) => {
    const { id } = req.params as any
    const result = await workspaceService.open(id)
    return reply.send(result)
  })

  // Publish workspace
  app.post('/api/platform/workspace/:id/publish', async (req, reply) => {
    const { id } = req.params as any
    const version = await workspaceService.publish(id)
    return reply.send(version)
  })

  // Archive workspace
  app.post('/api/platform/workspace/:id/archive', async (req, reply) => {
    const { id } = req.params as any
    await workspaceService.archive(id)
    return reply.code(204).send()
  })

  // Search workspaces
  app.get('/api/platform/workspace/search/:query', async (req, reply) => {
    const { query } = req.params as any
    const workspaces = await workspaceService.search(query)
    return reply.send(workspaces)
  })
}
