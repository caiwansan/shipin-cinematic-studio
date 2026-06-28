// Production Loop API v1
// REST endpoints for Studio production pipeline

import type { FastifyInstance } from 'fastify'
import { renderExecutor } from './render-executor.js'
import { compileStoryboard } from './prompt-compiler.js'
import { eventBus } from './event-bus.js'
import { renderQueue } from './render-queue.js'
import { renderRouter } from './render-router.js'
import { renderIntelligence } from './render-intelligence.js'
import { productionRunner } from './production-runner.js'
import { costLearner } from './cost-learner.js'
import { slaController } from './sla-controller.js'
import { initVideoProviders } from './video/init.js'
import type { StoryboardShot } from './prompt-compiler.js'
import type { SceneContext } from './prompt-compiler.js'

export function registerProductionRoutes(app: FastifyInstance): void {

  // Init video providers on first route registration
  initVideoProviders()

  // ── Compile Storyboard to Prompts ──
  app.post('/api/production/compile', async (req, reply) => {
    const { shots, context } = req.body as {
      shots: StoryboardShot[]
      context: Partial<SceneContext>
    }

    if (!shots?.length) {
      return reply.status(400).send({ error: 'shots required' })
    }

    const result = compileStoryboard(shots, context)
    return {
      shots: result.shots,
      batch: {
        imagePrompts: result.shots.map(s => s.imagePrompt),
        videoPrompts: result.shots.map(s => s.videoPrompt),
        audioPrompts: result.shots.map(s => s.audioPrompt),
      },
      sceneContext: result.sceneContext,
      errors: result.errors,
    }
  })

  // ── Start Render Job ──
  app.post('/api/production/render', async (req, reply) => {
    const { projectId, pipelineId, stepId, shots, context } = req.body as {
      projectId: string
      pipelineId: string
      stepId: string
      shots: StoryboardShot[]
      context: Partial<SceneContext>
    }

    if (!shots?.length) {
      return reply.status(400).send({ error: 'shots required' })
    }

    const job = await renderExecutor.compilePrompts(projectId, pipelineId, stepId, shots, context)

    // Emit events
    if (job.status === 'completed') {
      eventBus.emit({
        type: 'pipeline.completed',
        projectId,
        pipelineId,
        data: { jobId: job.id, shotCount: shots.length },
      })
    } else if (job.status === 'failed') {
      eventBus.emit({
        type: 'pipeline.failed',
        projectId,
        pipelineId,
        error: job.errors.join('; '),
      })
    }

    return {
      job,
      compileResult: job.compileResult ? {
        shots: job.compileResult.shots.map(s => ({
          shotNumber: s.shotNumber,
          imagePrompt: s.imagePrompt,
          videoPrompt: s.videoPrompt,
          audioPrompt: s.audioPrompt,
        })),
      } : undefined,
    }
  })

  // ── Get Render Job Status ──
  app.get('/api/production/render/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = renderExecutor.getJob(jobId)
    if (!job) return reply.status(404).send({ error: 'Job not found' })
    return { job }
  })

  // ── List Render Jobs ──
  app.get('/api/production/render', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    const jobs = renderExecutor.listJobs(projectId)
    return { jobs }
  })

  // ── Get Pipeline Events ──
  app.get('/api/production/events', async (req, reply) => {
    const { projectId, limit } = req.query as { projectId?: string; limit?: string }
    const events = eventBus.getHistory(projectId, limit ? parseInt(limit) : 50)
    return { events }
  })

  // ── Retry Failed Step ──
  app.post('/api/production/retry', async (req, reply) => {
    const { projectId, stepId } = req.body as { projectId: string; stepId: string }
    const event = await eventBus.retryLast(projectId, stepId)
    if (!event) return reply.status(404).send({ error: 'No event to retry' })
    return { event }
  })

  // ── Video Render Queue ──
  app.post('/api/production/render-video', async (req, reply) => {
    const { projectId, sceneId, prompt, duration, width, height } = req.body as {
      projectId: string
      sceneId: string
      prompt: string
      duration?: number
      width?: number
      height?: number
    }

    const videoPrompt = {
      id: `vp-${Date.now()}`,
      sceneId,
      projectId,
      prompt,
      duration: duration || 5,
      width: width || 1280,
      height: height || 720,
    }

    const job = await renderQueue.enqueue(videoPrompt)
    return { job }
  })

  app.get('/api/production/render-video/:jobId', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = renderQueue.getJob(jobId)
    if (!job) return reply.status(404).send({ error: 'Job not found' })
    return { job }
  })

  app.get('/api/production/render-video/queue/stats', async () => {
    return renderQueue.getQueueStats()
  })

  // ── Video Provider Status ──
  app.get('/api/production/providers/video', async () => {
    const { listVideoProviders, getVideoProvider } = await import('./video/video-provider.js')
    const providers = listVideoProviders()
    const statuses = await Promise.all(
      providers.map(async name => {
        const p = getVideoProvider(name)
        return p ? p.status() : null
      })
    )
    return { providers: statuses.filter(Boolean) }
  })

  // ── Render Router (quality-tier routing) ──
  app.post('/api/production/render-router', async (req, reply) => {
    const { prompt, quality } = req.body as {
      prompt: any
      quality?: 'fast' | 'balanced' | 'production'
    }

    if (!prompt || !prompt.sceneId || !prompt.prompt) {
      return reply.status(400).send({ error: 'prompt with sceneId and prompt fields required' })
    }

    const result = await renderRouter.route(prompt, quality)
    return result
  })

  app.post('/api/production/route-batch', async (req, reply) => {
    const { projectId, shots, quality } = req.body as {
      projectId: string
      shots: Array<{ sceneNumber: number; shotNumber: number; videoPrompt: string }>
      quality?: 'fast' | 'balanced' | 'production'
    }

    if (!shots?.length) {
      return reply.status(400).send({ error: 'shots required' })
    }

    const jobs = await renderRouter.routeBatch(projectId, shots, quality)
    return { jobs, count: jobs.length }
  })

  app.get('/api/production/render-router/status', async () => {
    return renderRouter.getRouterStatus()
  })

  // Remove the old duplicate init from index.ts — init happens here now

  // ── Render Intelligence Layer ──

  app.post('/api/production/intelligence/decide', async (req, reply) => {
    const { prompt, constraints } = req.body as {
      prompt: {
        id: string
        sceneId: string
        projectId: string
        prompt: string
        duration: number
        width: number
        height: number
        cameraMotion?: string
        seed?: number
      }
      constraints?: {
        maxBudgetUsd?: number
        maxLatencyMs?: number
        minQualityScore?: number
        preferredProvider?: string
        forceProvider?: string
      }
    }

    if (!prompt || !prompt.prompt) {
      return reply.status(400).send({ error: 'prompt object with prompt field required' })
    }

    const decision = await renderIntelligence.decide(prompt, constraints)
    return { decision }
  })

  app.post('/api/production/intelligence/execute', async (req, reply) => {
    const { prompt, constraints } = req.body as {
      prompt: {
        id: string
        sceneId: string
        projectId: string
        prompt: string
        duration: number
        width: number
        height: number
        cameraMotion?: string
        seed?: number
      }
      constraints?: {
        maxBudgetUsd?: number
        maxLatencyMs?: number
        minQualityScore?: number
        preferredProvider?: string
        forceProvider?: string
      }
    }

    if (!prompt || !prompt.prompt) {
      return reply.status(400).send({ error: 'prompt object required' })
    }

    const result = await renderIntelligence.execute(prompt, constraints)
    return result
  })

  app.get('/api/production/intelligence/status', async () => {
    return renderIntelligence.getIntelligenceStatus()
  })

  app.get('/api/production/cost-profiles', async () => {
    const { listProfiles } = await import('./cost-profiles.js')
    return { profiles: listProfiles() }
  })

  // ── Cost Learning ──
  app.post('/api/production/cost-learner/record', async (req, reply) => {
    const record = req.body as {
      provider: string
      model: string
      duration: number
      latencyMs: number
      cost: number
      qualityScore: number
      timestamp: string
      success: boolean
      error?: string
    }
    costLearner.record({
      provider: record.provider,
      model: record.model,
      duration: record.duration,
      latencyMs: record.latencyMs,
      cost: record.cost,
      qualityScore: record.qualityScore,
      timestamp: record.timestamp,
      success: record.success,
      error: record.error,
    })
    return { success: true }
  })

  app.get('/api/production/cost-learner/stats', async () => {
    return costLearner.getStats()
  })

  // ── SLA Controller ──
  app.get('/api/production/sla/status', async () => {
    return slaController.getStatus()
  })

  app.post('/api/production/sla/override', async (req, reply) => {
    const { tier, config } = req.body as { tier: 'fast' | 'balanced' | 'production'; config: any }
    slaController.override(tier, config)
    return { success: true }
  })

  app.get('/api/production/sla/violations', async (req) => {
    const { tier, limit } = req.query as { tier?: 'fast' | 'balanced' | 'production'; limit?: string }
    return { violations: slaController.getViolations(tier, limit ? parseInt(limit) : 50) }
  })

  // ── Production Runner (10-shot test suite) ──
  app.post('/api/production/runner/run', async (req, reply) => {
    const { shots, context, qualityTier, projectId, sceneId } = req.body as {
      shots: any[]
      context: any
      qualityTier: 'fast' | 'balanced' | 'production'
      projectId?: string
      sceneId?: string
    }

    if (!shots?.length) {
      return reply.status(400).send({ error: 'shots required' })
    }

    const result = await productionRunner.run({
      projectId: projectId || `api-run-${Date.now()}`,
      sceneId: sceneId || 'default-scene',
      shots,
      sceneContext: context || {},
      qualityTier: qualityTier || 'balanced',
    })

    return result
  })

  app.get('/api/production/runner/stats', async () => {
    return {
      costLearner: costLearner.getStats(),
      sla: slaController.getStatus(),
      queue: renderQueue.getQueueStats(),
    }
  })

  // ── Volcengine Image Generation ──
  app.post('/api/production/generate-image', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user?.id || (req as any).userId
    if (!userId) return reply.status(401).send({ error: '未授权' })

    const { prompt, size, n, model } = req.body as {
      prompt: string
      size?: string
      n?: number
      model?: string
    }

    if (!prompt) return reply.status(400).send({ error: 'prompt required' })

    const { ImageAdapter } = await import('../runtime/adapters/image/ImageAdapter.js')
    const adapter = new ImageAdapter()
    const images = await adapter.execute(userId, { prompt, size, n, model })
    return { images, count: Array.isArray(images) ? images.length : 1 }
    return { images, count: images.length }
  })
}
