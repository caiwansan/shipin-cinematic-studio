// ============================================================
// Undo/Redo Routes — 撤销/重做
// ============================================================

import type { FastifyInstance } from 'fastify'
import { workspaceService } from '../../../services/platform/workspace/workspace.service.js'

export default async function undoRedoRoutes(app: FastifyInstance) {
  // Undo
  app.post('/api/platform/workspace/:workspaceId/undo', async (req, reply) => {
    const { workspaceId } = req.params as any
    const result = await workspaceService.undo(workspaceId)
    return reply.send({ undone: result })
  })

  // Redo
  app.post('/api/platform/workspace/:workspaceId/redo', async (req, reply) => {
    const { workspaceId } = req.params as any
    const result = await workspaceService.redo(workspaceId)
    return reply.send({ redone: result })
  })

  // Get undo/redo state
  app.get('/api/platform/workspace/:workspaceId/undo-redo', async (req, reply) => {
    const { workspaceId } = req.params as any
    const state = workspaceService.getUndoRedoState(workspaceId)
    return reply.send(state)
  })
}
