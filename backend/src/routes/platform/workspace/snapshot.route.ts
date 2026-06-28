// ============================================================
// Snapshot Routes — Snapshot 管理
// ============================================================

import type { FastifyInstance } from 'fastify'
import { snapshotSystem } from '../../../services/platform/workspace/snapshot/snapshot-system.js'

export default async function snapshotRoutes(app: FastifyInstance) {
  // Create snapshot
  app.post('/api/platform/workspace/:workspaceId/snapshot', async (req, reply) => {
    const { workspaceId } = req.params as any
    const body = req.body as any
    const snapshot = await snapshotSystem.createSnapshot(workspaceId, {
      label: body?.label,
      runtimeState: body?.runtimeState,
      assetState: body?.assetState,
      graphState: body?.graphState,
      variables: body?.variables,
    })
    return reply.code(201).send(snapshot)
  })

  // List snapshots
  app.get('/api/platform/workspace/:workspaceId/snapshot', async (req, reply) => {
    const { workspaceId } = req.params as any
    const snapshots = await snapshotSystem.listSnapshots(workspaceId)
    return reply.send(snapshots)
  })

  // Restore snapshot
  app.post('/api/platform/workspace/snapshot/:snapshotId/restore', async (req, reply) => {
    const { snapshotId } = req.params as any
    const result = await snapshotSystem.restoreSnapshot(snapshotId)
    return reply.send(result)
  })

  // Delete snapshot
  app.delete('/api/platform/workspace/snapshot/:snapshotId', async (req, reply) => {
    const { snapshotId } = req.params as any
    await snapshotSystem.deleteSnapshot(snapshotId)
    return reply.code(204).send()
  })

  // Get snapshot count
  app.get('/api/platform/workspace/:workspaceId/snapshot/count', async (req, reply) => {
    const { workspaceId } = req.params as any
    const count = await snapshotSystem.countSnapshots(workspaceId)
    return reply.send({ count })
  })

  // Get latest snapshot
  app.get('/api/platform/workspace/:workspaceId/snapshot/latest', async (req, reply) => {
    const { workspaceId } = req.params as any
    const snapshot = await snapshotSystem.getLatestSnapshot(workspaceId)
    if (!snapshot) return reply.code(404).send({ error: 'No snapshots found' })
    return reply.send(snapshot)
  })
}
