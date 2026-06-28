/**
 * agents/orchestrator/UOA.ts
 *
 * Unified Orchestrator Agent v1
 *
 * Single entry point for short-drama video generation pipeline.
 * Delegates to existing systems (CTBL, queue, worker).
 * Does NOT replace DirectorAgent — serves as execution authority layer.
 */

import { shadow } from './shadow/UOAShadow.js'

export interface VideoJobContext {
  id: string
  projectId: string
  userId: string
  script?: string
  segments?: any[]
  videoStyle?: string
  aspectRatio?: string
  provider?: string
  model?: string
}

export interface VideoJobResult {
  jobId: string
  status: 'completed' | 'partial' | 'failed'
  segments: { index: number; taskId: string; url: string }[]
  error?: string
  duration: number
}

export class OrchestratorAgent {
  private enabled: boolean = true

  constructor() {
    console.log('[UOA] ✅ Unified Orchestrator Agent v1 initialized')
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(state: boolean): void {
    this.enabled = state
    console.log(`[UOA] 🔄 Orchestrator ${state ? 'ENABLED' : 'DISABLED'}`)
  }

  /**
   * Execute a full video generation job
   * Orchestrates multi-segment generation through existing queue
   */
  async execute(job: VideoJobContext): Promise<VideoJobResult> {
    const startTime = Date.now()
    console.log(`[UOA] 📦 job received: ${job.id} (${job.segments?.length || '?'} segments)`)

    if (!job.segments || job.segments.length === 0) {
      return {
        jobId: job.id,
        status: 'failed',
        segments: [],
        error: 'No segments provided',
        duration: 0,
      }
    }

    const results: { index: number; taskId: string; url: string }[] = []
    let hasFailure = false

    for (let i = 0; i < job.segments.length; i++) {
      const seg = job.segments[i]
      try {
        // Build the generation request (matches existing ai-tasks format)
        const requestBody = this.buildRequest(job, seg, i)

        // Submit to the existing queue via internal API
        const response = await this.submitTask(requestBody)

        if (response.taskId) {
          results.push({ index: i, taskId: response.taskId, url: '' })
          console.log(`[UOA] ✅ segment[${i}] queued: ${response.taskId.substring(0,12)}...`)
        } else {
          hasFailure = true
          console.warn(`[UOA] ⚠️ segment[${i}] submit failed:`, response.error)
        }
      } catch (err: any) {
        hasFailure = true
        console.error(`[UOA] ❌ segment[${i}] error: ${err.message}`)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[UOA] 🏁 job ${job.id} completed in ${duration}ms | ${results.length}/${job.segments.length} queued`)

    // 🧠 Shadow learning (non-blocking, no production impact)
    const result: VideoJobResult = {
      jobId: job.id,
      status: hasFailure ? 'partial' : 'completed',
      segments: results,
      duration,
    }
    shadow.simulate(job, result).catch(() => {})

    return {
      jobId: job.id,
      status: hasFailure ? 'partial' : 'completed',
      segments: results,
      duration,
    }
  }

  /**
   * Build a task request body matching the ai-tasks API format
   * Preserves all existing CTBL/OBS injection points
   */
  private buildRequest(job: VideoJobContext, seg: any, index: number): any {
    return {
      projectId: job.projectId,
      taskType: 'video',
      input: {
        narrative: seg.narrative || '',
        dialogue: seg.dialogue || '',
        effects: seg.effects || '',
        duration: seg.duration || 5,
        ratio: job.aspectRatio || '9:16',
        model: job.model || 'doubao-seedance-1-5-pro-251215',
        videoStyle: job.videoStyle || 'realistic',
        segmentIndex: String(index),
        characters: seg.characters || [],
        scenes: seg.scenes || [],
        storyboard: seg.storyboard || {},
      },
    }
  }

  /**
   * Submit a generation task to the internal queue
   */
  private async submitTask(body: any): Promise<{ taskId?: string; error?: string }> {
    // The orchestration layer submits to the existing queue
    // (In production, this would call the queue directly or via API)
    try {
      // This is a placeholder — actual submission goes through
      // the existing task queue which handles provider routing + CTBL + OBS
      return { taskId: `uoa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  /**
   * Post-processing hook after job completion
   */
  postProcess(jobId: string, result: VideoJobResult): void {
    // Hook for future: failure retry, prompt correction, etc.
    console.log(`[UOA] 🔄 postProcess: ${jobId} | status=${result.status} | segments=${result.segments.length}`)
  }
}

// Singleton
export const uoa = new OrchestratorAgent()
