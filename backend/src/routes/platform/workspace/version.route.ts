// ============================================================
// Version Routes — Version 管理
// ============================================================

import type { FastifyInstance } from 'fastify'
import { versionRuntime } from '../../../services/platform/workspace/version/version-runtime.js'

export default async function versionRoutes(app: FastifyInstance) {
  // Create version
  app.post('/api/platform/workspace/:workspaceId/version', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { label, description, snapshotId, parentVersion } = req.body as any
    const version = await versionRuntime.createVersion(
      workspaceId, label, description, snapshotId, parentVersion,
    )
    return reply.code(201).send(version)
  })

  // List versions
  app.get('/api/platform/workspace/:workspaceId/version', async (req, reply) => {
    const { workspaceId } = req.params as any
    const versions = await versionRuntime.listVersions(workspaceId)
    return reply.send(versions)
  })

  // Publish version
  app.post('/api/platform/workspace/version/:versionId/publish', async (req, reply) => {
    const { versionId } = req.params as any
    const version = await versionRuntime.publishVersion(versionId)
    return reply.send(version)
  })

  // Restore version
  app.post('/api/platform/workspace/version/:versionId/restore', async (req, reply) => {
    const { versionId } = req.params as any
    const result = await versionRuntime.restoreVersion(versionId)
    return reply.send(result)
  })

  // Compare versions
  app.get('/api/platform/workspace/:workspaceId/version/compare', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { v1, v2 } = req.query as any
    const result = await versionRuntime.compareVersions(
      workspaceId, parseInt(v1), parseInt(v2),
    )
    return reply.send(result)
  })

  // Fork version
  app.post('/api/platform/workspace/:workspaceId/version/fork', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { versionId, forkLabel } = req.body as any
    const version = await versionRuntime.forkWorkspace(workspaceId, versionId, forkLabel)
    return reply.send(version)
  })

  // Get published version
  app.get('/api/platform/workspace/:workspaceId/version/published', async (req, reply) => {
    const { workspaceId } = req.params as any
    const version = await versionRuntime.getPublishedVersion(workspaceId)
    if (!version) return reply.code(404).send({ error: 'No published version' })
    return reply.send(version)
  })
}
