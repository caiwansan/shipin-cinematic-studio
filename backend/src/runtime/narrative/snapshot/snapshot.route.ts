/**
 * snapshot.route.ts — Snapshot Engine HTTP API
 * 
 * POST /api/narrative/snapshot/writer   → Writer Snapshot
 * POST /api/narrative/snapshot/planner  → Planner Snapshot
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { snapshotEngine } from './index.js'

export async function registerSnapshotRoutes(app: FastifyInstance) {
  app.post('/api/narrative/snapshot/writer', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    if (!body?.projectId) {
      return reply.status(400).send({ error: 'projectId required' })
    }
    const snapshot = await snapshotEngine.buildWriterSnapshot(body.projectId, {
      chapterNo: body.chapterNo || 1,
      focusCharacter: body.focusCharacter,
    })
    return reply.send(snapshot)
  })

  app.post('/api/narrative/snapshot/planner', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    if (!body?.projectId) {
      return reply.status(400).send({ error: 'projectId required' })
    }
    const snapshot = await snapshotEngine.buildPlannerSnapshot(body.projectId)
    return reply.send(snapshot)
  })

  app.get('/api/narrative/snapshot/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'active',
      builders: ['writer', 'planner'],
      philosophy: 'Facts are permanent. Views are temporary.',
    })
  })
}
