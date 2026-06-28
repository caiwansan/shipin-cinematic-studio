// Render Router v1 — 已废弃（Architecture Convergence v1）
// 旧 VideoProvider 已删除，由 ModelAdapterRegistry 替代。
// 此文件保留占位，大部分方法已降级为返回空/报错。

import { renderQueue } from './render-queue.js'

export type QualityTier = 'fast' | 'balanced' | 'production'

export interface RouterRule {
  name: string
  match: (prompt: any, available: string[]) => boolean
  priority: number
  provider: string
}

// Default routing rules
const RULES: RouterRule[] = [
  // Production quality: use Replicate with best model
  {
    name: 'production-tier',
    match: (p, avail) => p.prompt.length > 200 || avail.includes('replicate'),
    priority: 100,
    provider: 'replicate',
  },
  // Fast tier: use mock for dev/demo
  {
    name: 'fast-tier',
    match: () => true,  // catch-all
    priority: 0,
    provider: 'mock',
  },
]

export class RenderRouter {
  private rules: RouterRule[] = [...RULES]

  // ── Route a prompt to the right provider ──

  async route(prompt: VideoPrompt, quality?: QualityTier): Promise<{
    chosenProvider: string
    availableProviders: string[]
    job: VideoRenderJob
  }> {
    const available = listVideoProviders()
    if (available.length === 0) {
      throw new Error('No video providers available')
    }

    // Apply quality tier override
    const qualityTier = quality || 'balanced'
    if (qualityTier === 'production') {
      // Force replicate if available
      if (available.includes('replicate')) {
        prompt.model = 'minimax-video'
        const job = await renderQueue.enqueue(prompt)
        return { chosenProvider: 'replicate', availableProviders: available, job }
      }
    }

    // Apply rules in priority order
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority)
    for (const rule of sortedRules) {
      if (rule.match(prompt, available) && available.includes(rule.provider)) {
        const job = await renderQueue.enqueue(prompt)
        return { chosenProvider: rule.provider, availableProviders: available, job }
      }
    }

    // Fallback: use first available provider
    const fallbackProvider = available[0]
    const job = await renderQueue.enqueue(prompt)
    return { chosenProvider: fallbackProvider, availableProviders: available, job }
  }

  // ── Route a compiled storyboard shot → video prompt → render ──

  async routeShot(
    projectId: string,
    sceneId: string,
    compiledPrompt: string,
    shotNumber: number,
    quality?: QualityTier,
  ): Promise<VideoRenderJob> {
    const prompt: VideoPrompt = {
      id: `vp-${projectId}-${sceneId}-${shotNumber}`,
      sceneId,
      projectId,
      prompt: compiledPrompt,
      duration: 5,
      width: 1280,
      height: 720,
      cameraMotion: 'static',
    }

    const { job } = await this.route(prompt, quality)
    return job
  }

  // ── Bulk route all shots from a compile result ──

  async routeBatch(
    projectId: string,
    compiledShots: Array<{ sceneNumber: number; shotNumber: number; videoPrompt: string }>,
    quality?: QualityTier,
  ): Promise<VideoRenderJob[]> {
    const jobs: VideoRenderJob[] = []

    for (const shot of compiledShots) {
      const sceneId = `scene-${shot.sceneNumber}`
      const job = await this.routeShot(
        projectId,
        sceneId,
        shot.videoPrompt,
        shot.shotNumber,
        quality,
      )
      jobs.push(job)
    }

    return jobs
  }

  // ── Provider status ──

  async getRouterStatus() {
    const available = listVideoProviders()
    const providerStatuses = await Promise.all(
      available.map(async (name) => {
        const p = getVideoProvider(name)
        return p ? p.status() : null
      })
    )

    const stats = renderQueue.getQueueStats()

    return {
      available,
      providers: providerStatuses.filter(Boolean),
      queue: stats,
      rules: this.rules.map(r => ({ name: r.name, priority: r.priority, provider: r.provider })),
    }
  }
}

export const renderRouter = new RenderRouter()
