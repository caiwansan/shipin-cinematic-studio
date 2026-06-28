// Render Execution Layer v1
// Takes compiled prompts → dispatches to model providers → collects results

import { compileStoryboard, formatProductionBatch, type CompileResult, type SceneContext } from './prompt-compiler.js'
import type { StoryboardShot } from './schema.js'

// ── Render Job ──

export interface RenderJob {
  id: string
  projectId: string
  pipelineId: string
  stepId: string
  status: 'queued' | 'prompt_compiling' | 'image_rendering' | 'video_rendering' | 'audio_rendering' | 'completed' | 'completed_with_errors' | 'failed'
  shots: StoryboardShot[]
  sceneContext: SceneContext
  compileResult?: CompileResult
  results?: {
    images?: RenderResult[]
    videos?: RenderResult[]
    audio?: RenderResult[]
  }
  errors: string[]
  createdAt: string
  updatedAt: string
}

export interface RenderResult {
  shotIndex: number
  shotNumber: number
  type: 'image' | 'video' | 'audio'
  url?: string
  error?: string
  durationMs?: number
}

// ── Model Router ──

export interface ModelRoute {
  type: 'image' | 'video' | 'audio'
  provider: string
  model: string
  priority: number
}

const MODEL_ROUTES: ModelRoute[] = [
  { type: 'image', provider: 'replicate', model: 'flux-schnell', priority: 1 },
  { type: 'image', provider: 'replicate', model: 'flux-pro', priority: 2 },
  { type: 'video', provider: 'replicate', model: 'minimax-video', priority: 1 },     // placeholder
  { type: 'video', provider: 'local', model: 'comfyui', priority: 2 },                  // placeholder
  { type: 'audio', provider: 'local', model: 'edge-tts', priority: 1 },                // placeholder
]

export function routeModel(type: 'image' | 'video' | 'audio'): ModelRoute | undefined {
  return MODEL_ROUTES.filter(r => r.type === type).sort((a, b) => a.priority - b.priority)[0]
}

// ── Render Executor ──

export class RenderExecutor {
  private jobs = new Map<string, RenderJob>()

  async compilePrompts(
    projectId: string,
    pipelineId: string,
    stepId: string,
    shots: StoryboardShot[],
    ctx: Partial<SceneContext>,
  ): Promise<RenderJob> {
    const jobId = `render-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const job: RenderJob = {
      id: jobId,
      projectId,
      pipelineId,
      stepId,
      status: 'prompt_compiling',
      shots,
      sceneContext: ctx as SceneContext,
      errors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.jobs.set(jobId, job)

    try {
      const compileResult = await compileStoryboard(shots, ctx)
      job.compileResult = compileResult
      job.errors.push(...compileResult.errors)

      if (compileResult.shots.length === 0) {
        job.status = 'failed'
        job.errors.push('No valid shots to render')
        return job
      }

      job.status = 'image_rendering'
      job.updatedAt = new Date().toISOString()

      // Image rendering
      const images = await this.renderImages(compileResult, job)
      job.results = job.results || {}
      job.results.images = images

      // Audio rendering
      job.status = 'audio_rendering'
      job.updatedAt = new Date().toISOString()
      const audio = await this.renderAudio(compileResult, job)
      job.results.audio = audio

      // Video rendering (if video model available)
      job.status = 'video_rendering'
      const videos = await this.renderVideos(compileResult, job)
      job.results.videos = videos

      const failed = [...images, ...audio, ...videos].filter(r => r.error).length
      job.status = failed === 0 ? 'completed' : 'completed_with_errors'
    } catch (e: any) {
      job.status = 'failed'
      job.errors.push(e.message)
    }

    job.updatedAt = new Date().toISOString()
    return job
  }

  private async renderImages(compileResult: CompileResult, job: RenderJob): Promise<RenderResult[]> {
    const formatted = formatProductionBatch(compileResult)
    const results: RenderResult[] = []

    for (let i = 0; i < compileResult.shots.length; i++) {
      const shot = compileResult.shots[i]
      const prompt = formatted.imagePrompts[i]

      try {
        // Try to call the actual image gen provider
        const { getImageProvider, listImageProviders } = await import('../runtime/providers/provider.registry.js')
        const providers = listImageProviders()
        if (providers.length > 0) {
          const provider = getImageProvider(providers[0])
          if (provider) {
            const resp = await provider.generate({
              prompt,
              model: 'flux-schnell',
              width: 1344,
              height: 768,
              steps: 25,
            })
            results.push({
              shotIndex: i,
              shotNumber: shot.shotNumber,
              type: 'image',
              url: resp.images[0]?.url,
              durationMs: resp.metadata.latencyMs,
            })
            continue
          }
        }

        // Fallback: return prompt as result (for demo/development)
        results.push({
          shotIndex: i,
          shotNumber: shot.shotNumber,
          type: 'image',
          url: prompt, // In demo mode, the prompt itself is the "output"
        })
      } catch (e: any) {
        results.push({
          shotIndex: i,
          shotNumber: shot.shotNumber,
          type: 'image',
          error: e.message,
        })
        job.errors.push(`Image render shot ${shot.shotNumber}: ${e.message}`)
      }
    }

    return results
  }

  private async renderAudio(compileResult: CompileResult, job: RenderJob): Promise<RenderResult[]> {
    // Placeholder: audio will need TTS / music gen provider
    return compileResult.shots.map(shot => ({
      shotIndex: compileResult.shots.indexOf(shot),
      shotNumber: shot.shotNumber,
      type: 'audio' as const,
      url: shot.audioPrompt,
    }))
  }

  private async renderVideos(compileResult: CompileResult, job: RenderJob): Promise<RenderResult[]> {
    // Placeholder: video will need Runway / Sora / ComfyUI provider
    return compileResult.shots.map(shot => ({
      shotIndex: compileResult.shots.indexOf(shot),
      shotNumber: shot.shotNumber,
      type: 'video' as const,
      url: shot.videoPrompt,
    }))
  }

  getJob(jobId: string): RenderJob | undefined {
    return this.jobs.get(jobId)
  }

  listJobs(projectId?: string): RenderJob[] {
    const all = [...this.jobs.values()]
    return projectId ? all.filter(j => j.projectId === projectId) : all
  }
}

export const renderExecutor = new RenderExecutor()
