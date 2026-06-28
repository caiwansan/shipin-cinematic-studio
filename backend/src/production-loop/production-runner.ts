// Production Runner v1
// Runs a full Storyboard → Video production loop with Cost Learner + SLA tracking
// Executes 10 shots end-to-end and records all metrics

import { compileStoryboard } from './prompt-compiler.js'
import { renderIntelligence } from './render-intelligence.js'
import { costLearner } from './cost-learner.js'
import { slaController } from './sla-controller.js'
import { renderQueue } from './render-queue.js'
import { eventBus } from './event-bus.js'
import type { StoryboardShot, SceneContext } from './prompt-compiler.js'

// ── Production Run Manager ──

export interface ProductionRunConfig {
  projectId: string
  sceneId: string
  shots: StoryboardShot[]
  sceneContext: Partial<SceneContext>
  qualityTier: 'fast' | 'balanced' | 'production'
}

export interface ProductionRunResult {
  runId: string
  shots: Array<{
    shotNumber: number
    compiledPrompt: string
    decision: any
    job: any
    outputUrl?: string
    latencyMs: number
    cost: number
    slaViolations: any[]
    success: boolean
  }>
  summary: {
    totalDuration: number
    totalCost: number
    successRate: string
    avgLatencyMs: number
    slaPassRate: string
    costLearnerStats: any
    slaStatus: any
  }
}

export class ProductionRunner {
  async run(config: ProductionRunConfig): Promise<ProductionRunResult> {
    const runId = `prod-run-${Date.now()}`
    const { projectId, sceneId, shots, sceneContext, qualityTier } = config
    const results: ProductionRunResult['shots'] = []

    console.log(`[production-runner] Starting run ${runId}: ${shots.length} shots, tier=${qualityTier}`)

    for (const shot of shots) {
      const shotStart = Date.now()
      let success = false
      let outputUrl: string | undefined
      let decision: any = null
      let job: any = null
      let slaIssues: any[] = []

      try {
        // Step 1: Compile
        const compiled = await compileStoryboard([shot], sceneContext)
        const compiledShot = compiled.shots[0]
        if (!compiledShot) throw new Error('Compilation failed for shot')

        // Step 2: Intelligence decide
        const videoPrompt = {
          id: `vp-${runId}-${shot.shotNumber}`,
          sceneId,
          projectId,
          prompt: compiledShot.videoPrompt || compiledShot.imagePrompt,
          duration: 5,
          width: 1280,
          height: 720,
        }

        const { decision: d, job: j } = await renderIntelligence.execute(videoPrompt, {
          slaTier: qualityTier,
          maxBudgetUsd: qualityTier === 'balanced' ? 0.05 : qualityTier === 'fast' ? 0.01 : 0.50,
        })
        decision = d
        job = j

        // Step 3: Wait for completion (poll up to 30s)
        const completed = await this.pollJob(job.id, 30_000)

        if (completed?.status === 'completed' && completed?.output) {
          success = true
          outputUrl = completed.output.url

          // Step 4: Record to Cost Learner
          costLearner.record({
            provider: decision.chosenProvider,
            model: decision.chosenModel,
            duration: completed.prompt.duration,
            latencyMs: completed.output.latencyMs,
            cost: completed.output.cost || decision.estimatedCost,
            qualityScore: 0,
            timestamp: new Date().toISOString(),
            success: true,
          })

          // Step 5: Check SLA
          slaIssues = slaController.check(
            qualityTier,
            job.id,
            decision.chosenProvider,
            completed.output.latencyMs,
            completed.output.cost || 0,
            completed.prompt.duration,
          )
        }
      } catch (err: any) {
        console.error(`[production-runner] Shot ${shot.shotNumber} failed:`, err.message)

        // Record failure
        costLearner.record({
          provider: decision?.chosenProvider || 'unknown',
          model: decision?.chosenModel || 'unknown',
          duration: 0,
          latencyMs: Date.now() - shotStart,
          cost: 0,
          qualityScore: 0,
          timestamp: new Date().toISOString(),
          success: false,
          error: err.message,
        })
      }

      results.push({
        shotNumber: shot.shotNumber,
        compiledPrompt: decision?.chosenModel || 'unknown',
        decision,
        job,
        outputUrl,
        latencyMs: Date.now() - shotStart,
        cost: decision?.estimatedCost || 0,
        slaViolations: slaIssues,
        success,
      })
    }

    // Summary
    const successCount = results.filter(r => r.success).length
    const totalCost = results.reduce((s, r) => s + r.cost, 0)
    const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length
    const slaPassCount = results.filter(r => r.slaViolations.length === 0).length

    const summary: ProductionRunResult['summary'] = {
      totalDuration: Date.now() - parseInt(runId.split('-')[2]),
      totalCost,
      successRate: `${Math.round((successCount / results.length) * 100)}%`,
      avgLatencyMs: Math.round(avgLatency),
      slaPassRate: `${Math.round((slaPassCount / results.length) * 100)}%`,
      costLearnerStats: costLearner.getStats(),
      slaStatus: slaController.getStatus(),
    }

    // Emit completion event
    eventBus.emit({
      type: 'pipeline.completed',
      projectId,
      pipelineId: projectId,
      data: { runId, shotCount: results.length, successCount },
      metadata: { attempt: 1, durationMs: summary.totalDuration },
    })

    console.log(`[production-runner] Run ${runId} complete: ${summary.successRate} success, ${summary.slaPassRate} SLA pass, $${summary.totalCost.toFixed(4)} total`)

    return { runId, shots: results, summary }
  }

  private async pollJob(jobId: string, timeoutMs: number): Promise<any> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const job = renderQueue.getJob(jobId)
      if (!job) return null
      if (job.status === 'completed' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, 200))
    }
    return renderQueue.getJob(jobId)
  }
}

export const productionRunner = new ProductionRunner()
