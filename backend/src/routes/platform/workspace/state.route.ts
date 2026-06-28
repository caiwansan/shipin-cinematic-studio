// ============================================================
// State Routes — 运行时状态
// ============================================================

import type { FastifyInstance } from 'fastify'
import { runtimeStateManager } from '../../../services/platform/workspace/state/runtime-state.js'

export default async function stateRoutes(app: FastifyInstance) {
  // Save state
  app.put('/api/platform/workspace/:workspaceId/state', async (req, reply) => {
    const { workspaceId } = req.params as any
    const state = req.body as any
    await runtimeStateManager.saveState(workspaceId, state)
    return reply.send({ saved: true })
  })

  // Load state
  app.get('/api/platform/workspace/:workspaceId/state', async (req, reply) => {
    const { workspaceId } = req.params as any
    const state = await runtimeStateManager.loadState(workspaceId)
    if (!state) return reply.code(404).send({ error: 'No state found' })
    return reply.send(state)
  })

  // Patch state (partial update)
  app.patch('/api/platform/workspace/:workspaceId/state', async (req, reply) => {
    const { workspaceId } = req.params as any
    const patch = req.body as any
    const newState = await runtimeStateManager.patchState(workspaceId, patch)
    return reply.send(newState)
  })

  // Clear state
  app.delete('/api/platform/workspace/:workspaceId/state', async (req, reply) => {
    const { workspaceId } = req.params as any
    await runtimeStateManager.clearState(workspaceId)
    return reply.code(204).send()
  })

  // Check if state exists
  app.get('/api/platform/workspace/:workspaceId/state/exists', async (req, reply) => {
    const { workspaceId } = req.params as any
    const exists = await runtimeStateManager.hasState(workspaceId)
    return reply.send({ exists })
  })

  // Create checkpoint
  app.post('/api/platform/workspace/:workspaceId/state/checkpoint', async (req, reply) => {
    const { workspaceId } = req.params as any
    const state = req.body as any
    await runtimeStateManager.createCheckpoint(workspaceId, state)
    return reply.send({ checkpoint: true })
  })
}
