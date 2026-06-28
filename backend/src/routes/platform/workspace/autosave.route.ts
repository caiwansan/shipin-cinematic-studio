// ============================================================
// AutoSave Routes — AutoSave 配置
// ============================================================

import type { FastifyInstance } from 'fastify'
import { autoSaveService } from '../../../services/platform/workspace/autosave/autosave-service.js'
import { DEFAULT_AUTOSAVE_CONFIG } from '../../../services/platform/workspace/types.js'

export default async function autosaveRoutes(app: FastifyInstance) {
  // Start auto-save
  app.post('/api/platform/workspace/:workspaceId/autosave/start', async (req, reply) => {
    const { workspaceId } = req.params as any
    const config = (req.body as any) ?? {}
    autoSaveService.startAutoSave(workspaceId, {
      interval: config.interval ?? DEFAULT_AUTOSAVE_CONFIG.interval,
      maxSnapshots: config.maxSnapshots ?? DEFAULT_AUTOSAVE_CONFIG.maxSnapshots,
      debounceMs: config.debounceMs ?? DEFAULT_AUTOSAVE_CONFIG.debounceMs,
    })
    return reply.send({ started: true, workspaceId })
  })

  // Stop auto-save
  app.post('/api/platform/workspace/:workspaceId/autosave/stop', async (req, reply) => {
    const { workspaceId } = req.params as any
    autoSaveService.stopAutoSave(workspaceId)
    return reply.send({ stopped: true, workspaceId })
  })

  // Force flush auto-save
  app.post('/api/platform/workspace/:workspaceId/autosave/flush', async (req, reply) => {
    const { workspaceId } = req.params as any
    await autoSaveService.flush(workspaceId)
    return reply.send({ flushed: true, workspaceId })
  })

  // Mark dirty
  app.post('/api/platform/workspace/:workspaceId/autosave/dirty', async (req, reply) => {
    const { workspaceId } = req.params as any
    autoSaveService.onDirty(workspaceId)
    return reply.send({ marked: true, workspaceId })
  })

  // Get auto-save status
  app.get('/api/platform/workspace/autosave/status', async (req, reply) => {
    const status = autoSaveService.getStatus()
    return reply.send(status)
  })

  // Check if workspace has auto-save
  app.get('/api/platform/workspace/:workspaceId/autosave/status', async (req, reply) => {
    const { workspaceId } = req.params as any
    return reply.send({
      active: autoSaveService.isAutoSaving(workspaceId),
    })
  })

  // Update config
  app.patch('/api/platform/workspace/:workspaceId/autosave/config', async (req, reply) => {
    const { workspaceId } = req.params as any
    const config = req.body as any
    autoSaveService.updateConfig(workspaceId, config)
    return reply.send({ updated: true })
  })
}
